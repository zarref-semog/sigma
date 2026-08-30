# SIGMA

Sistema Integrado de Gerenciamento e Monitoramento de AGVs. A aplicação cadastra projetos e plantas baixas, modela pontos de interesse (com tags RFID) e rotas em grafo, prioriza missões, seleciona AGVs, evita colisões e acompanha a posição confirmada dos robôs em tempo real.

## Arquitetura

```mermaid
flowchart LR
    U[Usuário] -->|HTTP :8080| FE

    subgraph Client[Frontend]
        FE[React + TypeScript]
        UI[Dashboard / Projetos / Missões<br/>AGVs / Usuários / Configurações]
        KC[React Konva<br/>planta e canvas]
        FE --- UI
        UI --- KC
    end

    subgraph Edge[Entrada do sistema]
        NX[Nginx]
        GW[API Gateway<br/>JWT + RBAC + Rate Limit]
        WS[WebSocket /ws/agvs]
        NX -->|/api| GW
        NX -->|Upgrade /ws| WS
        WS --- GW
    end

    FE --> NX
    GW -->|RPC correlationId + replyTo| RMQ[(RabbitMQ)]
    RMQ -->|resposta RPC| GW
    GW -->|telemetria enriquecida| WS
    WS -->|posição e eventos| FE

    subgraph APIs[Microsserviços]
        UA[user-api<br/>autenticação e usuários]
        PA[project-api<br/>projetos, pontos e rotas]
        MA[mission-api<br/>missões e prioridades]
        AA[agv-api<br/>AGVs e estado operacional]
        RA[routes-worker<br/>orquestração e Dijkstra]
        RG[robot-gateway<br/>simulador RFID]
    end

    RMQ -->|sigma.users| UA
    RMQ -->|sigma.projects| PA
    RMQ -->|sigma.missions| MA
    RMQ -->|sigma.agvs| AA
    RMQ -->|sigma.routes| RA

    UA --> UDB[(MongoDB<br/>users_db)]
    PA --> PDB[(MongoDB<br/>projects_db)]
    PA --> N4J[(Neo4j<br/>InterestPoint / ROUTE)]
    MA --> MDB[(MongoDB<br/>missions_db)]
    AA --> ADB[(MongoDB<br/>agvs_db)]
    RA --> RDB[(MongoDB<br/>settings e reservas)]
    RA --> N4J

    MA -->|sigma.mission.dispatch<br/>prioridade 1..3| RMQ
    RMQ -->|missões pendentes| RA
    RA -->|RPC: consulta/atualiza| RMQ
    RA -->|sigma.robot.commands| RMQ
    RMQ -->|roteiro sem coordenadas| RG
    RG -->|sigma.robot.telemetry.raw<br/>RFID detectado| RMQ
    RMQ -->|RFID bruto| RA
    RG -->|sigma.robot.events| RMQ
    RMQ -->|conclusão/falha| RA
    RA -->|sigma.robot.telemetry<br/>RFID + x/y| RMQ
    RMQ -->|telemetria| GW
```

### Responsabilidades

| Componente    | Responsabilidade                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Frontend      | Interface administrativa, editor da planta, dashboard e cliente WebSocket.                                                    |
| Nginx         | Serve a SPA e encaminha HTTP e WebSocket ao API Gateway.                                                                      |
| API Gateway   | Autentica JWT, aplica permissões, converte HTTP em RPC RabbitMQ e transmite telemetria por WebSocket.                        |
| user-api      | Login e CRUD de usuários.                                                                                                    |
| project-api   | Metadados da planta no MongoDB; pontos RFID e relacionamentos`ROUTE` no Neo4j.                                              |
| mission-api   | CRUD de missões e publicação na fila prioritária.                                                                         |
| agv-api       | Cadastro, vínculo com projeto, bateria, estado, missão e último ponto RFID do AGV.                                         |
| routes-worker | Escalonamento, seleção do AGV, cálculo do caminho, reservas, prevenção de colisões, resolução RFID e configurações por filas. |
| robot-gateway | Simula o protocolo do robô: recebe roteiro, executa giros/deslocamentos e reporta apenas RFID.                               |

## Casos de uso por perfil de usuário

```mermaid
graph LR
    subgraph Sigma[SIGMA]
        UC1[Fazer login e encerrar sessão]
        UC2[Visualizar dashboard e telemetria]
        UC3[Gerenciar projetos]
        UC4[Cadastrar planta, pontos RFID e rotas]
        UC5[Gerenciar missões]
        UC6[Gerenciar AGVs]
        UC7[Gerenciar usuários]
        UC8[Alterar configurações do escalonador]
    end

    Admin((Administrador))
    Operator((Operador))
    Designer((Designer))
    Maintenance((Manutenção))
    Viewer((Visualizador))

    Admin --> UC1
    Admin --> UC2
    Admin --> UC3
    Admin --> UC4
    Admin --> UC5
    Admin --> UC6
    Admin --> UC7
    Admin --> UC8

    Operator --> UC1
    Operator --> UC2
    Operator --> UC5

    Designer --> UC1
    Designer --> UC2
    Designer --> UC3
    Designer --> UC4

    Maintenance --> UC1
    Maintenance --> UC2
    Maintenance --> UC6

    Viewer --> UC1
    Viewer --> UC2
```

| Perfil | Permissões na interface |
| --- | --- |
| Administrador | Acesso total a projetos, pontos e rotas, missões, AGVs, usuários e configurações. |
| Operador | Acompanhamento do dashboard e CRUD de missões. |
| Designer | Acompanhamento do dashboard e CRUD de projetos, plantas, pontos RFID e rotas. |
| Manutenção | Acompanhamento do dashboard e CRUD de AGVs. |
| Visualizador | Acesso somente ao dashboard e à telemetria em tempo real. |

As permissões de escrita também são validadas pelo API Gateway a partir da role presente no token JWT; ocultar uma opção no frontend não substitui a autorização no backend.

## Sequência completa de uma missão

```mermaid
sequenceDiagram
    autonumber
    actor User as Usuário
    participant FE as Frontend
    participant GW as API Gateway
    participant MQ as RabbitMQ
    participant MA as mission-api
    participant MM as MongoDB missions_db
    participant RA as routes-worker
    participant AA as agv-api
    participant AM as MongoDB agvs_db
    participant N4J as Neo4j
    participant RR as MongoDB routes_db
    participant RG as robot-gateway
    participant WS as WebSocket

    User->>FE: Cadastra missão (projeto, origem, destino, prioridade)
    FE->>GW: POST /api/missions + JWT
    GW->>MQ: RPC sigma.missions
    MQ->>MA: Requisição correlacionada
    MA->>MM: Salva missão Pending
    MA->>MQ: Publica sigma.mission.dispatch com prioridade
    MA-->>MQ: Resposta RPC 201
    MQ-->>GW: Resposta correlacionada
    GW-->>FE: Missão criada

    loop Consumo contínuo e reconciliação configurável
        MQ->>RA: Próxima missão por prioridade e FIFO no empate
        RA->>MQ: RPC GET missão e AGVs
        MQ->>MA: Consulta missão
        MQ->>AA: Consulta AGVs
        MA->>MM: Lê missão
        AA->>AM: Lê AGVs disponíveis do projeto
        RA->>N4J: Carrega pontos e relacionamentos
        RA->>RR: Lê trechos e pontos reservados
        RA->>RA: Dijkstra exclui arestas, pontos e posições ocupadas
    end

    alt Existe AGV e caminho livre
        RA->>RR: Reserva todos os trechos e pontos (índices únicos)
        RA->>MQ: Atualiza AGV e missão via RPC
        MQ->>AA: Executing Mission + currentMission
        MQ->>MA: In Progress + AGV selecionado
        RA->>MQ: Publica sigma.robot.commands
        MQ->>RG: TURN / MOVE com IDs e tags RFID

        loop Cada novo ponto físico alcançado
            RG->>RG: Simula giro e deslocamento sem conhecer x/y
            RG->>MQ: sigma.robot.telemetry.raw (rfidTag)
            MQ->>RA: RFID detectado
            RA->>N4J: Resolve projectId + RFID para ponto x/y
            RA->>MQ: RPC consulta ocupação dos AGVs
            MQ->>AA: Verifica e atualiza último ponto
            alt Ponto livre
                RA->>MQ: sigma.robot.telemetry enriquecida
                MQ->>GW: AGV + ponto + x/y
                GW->>WS: Broadcast autenticado
                WS->>FE: Atualiza AGV no Dashboard
            else Ponto ocupado
                RA->>MQ: AGV_POSITION_REJECTED
                MQ->>GW: Evento de conflito
                GW->>WS: Notifica sem sobrepor AGVs
            end
        end

        RG->>MQ: ROUTE_COMPLETED
        MQ->>RA: Evento de conclusão
        RA->>MQ: RPC PUT missão Completed
        MQ->>MA: Atualiza situação
        MA->>MM: Persiste conclusão
        RA->>RR: Libera reservas da missão
        RA->>MQ: MISSION_COMPLETED
        MQ->>GW: Atualização do painel
        GW->>WS: Missões concluídas +1
        WS->>FE: Atualiza contador

        opt Retorno automático à carga habilitado
            RA->>N4J: Busca zona de carga livre mais próxima
            RA->>RR: Reserva pontos e trechos de retorno
            RA->>MQ: Publica RETURN_TO_CHARGE
            MQ->>RG: Novo roteiro por RFID
            RG->>MQ: Telemetria RFID do retorno
            MQ->>RA: RFID bruto
            RA->>N4J: Resolve coordenadas
            RA->>MQ: Telemetria enriquecida
            MQ->>GW: Posição confirmada
            GW->>WS: Atualiza Dashboard
            RG->>MQ: CHARGING_ZONE_REACHED
            MQ->>RA: Conclusão do retorno
            RA->>RR: Libera reservas de retorno
            RA->>MQ: RPC PUT status Charging e localização final
            MQ->>AA: Atualiza AGV
            AA->>AM: Persiste estado e ponto RFID
        end
    else Nenhum AGV ou caminho livre
        RA-->>MQ: Confirma mensagem sem atribuir
        Note over RA,MQ: Missão permanece Pending e volta à fila na reconciliação
    end
```

## Fluxo RPC HTTP

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant GW as API Gateway
    participant MQ as RabbitMQ
    participant API as API de domínio

    FE->>GW: HTTP /api/recurso + Bearer JWT
    GW->>GW: Valida token, papel e rate limit
    GW->>MQ: sendToQueue(queue, request, correlationId, replyTo)
    MQ->>API: Entrega requisição RPC
    API->>API: Executa endpoint HTTP interno
    API->>MQ: status + contentType + body
    MQ->>GW: Resposta na fila exclusiva pelo correlationId
    GW-->>FE: Resposta HTTP original
```

## Persistência

- `users_db`: usuários, credenciais com hash e perfil de acesso.
- `projects_db`: nome, descrição, imagem da planta e dimensões do canvas.
- `missions_db`: projeto, origem, destino, prioridade, situação e AGV atribuído.
- `agvs_db`: projeto, identificação, bateria, estado, missão e último ponto RFID.
- `routes_db`: configurações globais, reservas exclusivas de arestas e pontos.
- Neo4j: nós `InterestPoint` com RFID, tipo, direções e coordenadas; relacionamentos `ROUTE`.
- RabbitMQ: mensagens RPC, fila prioritária, comandos do robô, eventos e telemetria.

## Filas RabbitMQ

| Fila                          | Produtor principal          | Consumidor principal      |
| ----------------------------- | --------------------------- | ------------------------- |
| `sigma.users`               | API Gateway / routes-worker | user-api                  |
| `sigma.projects`            | API Gateway                 | project-api               |
| `sigma.missions`            | API Gateway / routes-worker | mission-api               |
| `sigma.agvs`                | API Gateway / routes-worker | agv-api                   |
| `sigma.routes`              | API Gateway                 | routes-worker             |
| `sigma.mission.dispatch`    | reconciliador               | routes-worker             |
| `sigma.robot.commands`      | routes-worker               | robot-gateway             |
| `sigma.robot.telemetry.raw` | robot-gateway               | routes-worker             |
| `sigma.robot.events`        | robot-gateway               | routes-worker             |
| `sigma.robot.telemetry`     | routes-worker               | API Gateway               |

## Execução com Docker

Com o Docker Desktop em execução:

```bash
docker compose up --build
```

Serviços expostos no host:

- Frontend: [http://localhost:8080](http://localhost:8080)
- API Gateway: [http://localhost:3000](http://localhost:3000)
- RabbitMQ Management: [http://localhost:15672](http://localhost:15672) (`sigma` / `sigma_rabbit_password`)
- Neo4j Browser: [http://localhost:7474](http://localhost:7474) (`neo4j` / `sigma_password`)

Credenciais iniciais da aplicação:

- E-mail: `admin@sigma.local`
- Senha: `Sigma@123`

O administrador inicial é criado somente quando ainda não existe. Altere `ADMIN_EMAIL`, `ADMIN_PASSWORD`, credenciais dos bancos e `JWT_SECRET` antes de usar o sistema fora do ambiente local.

Para encerrar sem apagar os dados:

```bash
docker compose down
```

Para encerrar e remover os volumes persistentes:

```bash
docker compose down -v
```

> Atenção: `docker compose down -v` remove permanentemente os dados do MongoDB, Neo4j e RabbitMQ.

## Portas internas

| Serviço      | Porta |
| ------------- | ----: |
| API Gateway   |  3000 |
| user-api      |  3001 |
| project-api   |  3002 |
| mission-api   |  3003 |
| agv-api       |  3004 |
| robot-gateway |  3006 |

As APIs de domínio não são publicadas no host. Todo acesso da interface passa pelo Nginx e pelo API Gateway.
