# Routes Worker

Worker responsável por escalonar missões, selecionar AGVs e reservar caminhos livres. Não expõe API ou porta HTTP; toda comunicação ocorre pelo RabbitMQ.

O planejador consulta missões e AGVs por RPC no RabbitMQ. Os caminhos são calculados a partir do grafo do projeto no Neo4j. Cada relacionamento é normalizado como uma chave bidirecional e reservado no MongoDB; portanto, dois AGVs não podem ocupar o mesmo trecho em sentidos iguais ou opostos. Se o menor caminho estiver ocupado, o algoritmo de Dijkstra seleciona uma alternativa livre.

As reservas usam uma janela móvel: cada AGV bloqueia somente o ponto atual, o próximo ponto e o trecho entre eles. Ao detectar o RFID seguinte, a janela avança e libera o trecho percorrido. Assim vários AGVs podem seguir pela mesma rota mantendo pelo menos um ponto de separação. Uma posição conflitante é rejeitada e não é desenhada no Dashboard.

São elegíveis AGVs disponíveis ou carregando, sem missão atual e com bateria acima de `MIN_AGV_BATTERY`.

O escalonador consome continuamente `sigma.mission.dispatch` e alterna `High`, `Medium` e `Low`, preservando FIFO em cada nível. A atribuição usa um pool de `worker_threads` configurado por `MISSION_ASSIGNMENT_WORKERS`.

A fila `sigma.routes` aceita somente comandos de leitura e atualização das configurações do escalonador, encaminhados pelo API Gateway.

A telemetria recebida do Robot Gateway contém somente a tag RFID detectada. O serviço resolve essa tag no grafo do projeto, atualiza a localização persistida do AGV e publica para o Dashboard a posição `x/y` cadastrada no ponto.
