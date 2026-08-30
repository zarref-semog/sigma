# Robot Gateway

Simulador da comunicação com os AGVs. O robô não conhece coordenadas cartesianas: ele informa apenas a tag detectada pelo leitor RFID.

Consome roteiros da fila `sigma.robot.commands`, executa comandos de giro e deslocamento e publica:

- telemetria contínua em `sigma.robot.telemetry.raw`, encaminhada pelo `routes-worker` para `sigma.robot.telemetry`;
- conclusão ou falha em `sigma.robot.events`.

A velocidade da simulação pode ser alterada por `ROBOT_STEP_INTERVAL_MS`. Em produção, este processo pode ser substituído por um adaptador que traduza os mesmos comandos para o protocolo físico dos robôs.

O `routes-worker` recebe a tag, consulta o ponto correspondente no Neo4j e acrescenta as coordenadas `x/y` antes de encaminhar a telemetria ao API Gateway. Consequentemente, o Dashboard atualiza a posição somente quando uma tag é detectada; não há interpolação fictícia entre dois pontos.
