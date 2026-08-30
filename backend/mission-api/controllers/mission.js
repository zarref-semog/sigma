const { Mission } = require('../models/mission');

module.exports = class MissionController {

    static async create(req, res) {
        const mission = new Mission({
            projectId: req.body.projectId,
            source: req.body.source,
            sourceName: req.body.sourceName,
            destination: req.body.destination,
            destinationName: req.body.destinationName,
            agv: req.body.agv,
            priority: req.body.priority,
            status: req.body.status
        });

        mission.save()
            .then(data => {
                res.status(201).send(data);
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        'Erro ao criar a missão.'
                });
            });
    }

    static async findById(req, res) {
        const { id } = req.params;

        Mission.findById(id)
            .then(data => {
                if (!data) {
                    res.status(404).json({
                        message: `Missão não encontrada para o ID: ${id}`
                    });
                } else {
                    res.status(200).send(data);
                }
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        `Erro ao buscar a missão ${id}.`
                });
            });
    }

    static async findAll(req, res) {
        Mission.find()
            .then(data => {
                res.status(200).send(data);
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        'Erro ao buscar as missões.'
                });
            });
    }

    static async update(req, res) {
        const { id } = req.params;

        Mission.findByIdAndUpdate(
            id,
            req.body,
            {
                returnDocument: 'after',
                runValidators: true
            }
        )
            .then(data => {
                if (!data) {
                    res.status(404).json({
                        message: `Missão não encontrada para o ID: ${id}`
                    });
                } else {
                    res.status(200).send({
                        message: `Missão ${id} atualizada com sucesso!`,
                        mission: data
                    });
                }
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        `Erro ao atualizar a missão ${id}.`
                });
            });
    }

    static async delete(req, res) {
        const { id } = req.params;

        Mission.findByIdAndDelete(id)
            .then(data => {
                if (!data) {
                    res.status(404).json({
                        message: 'Missão não encontrada.'
                    });
                } else {
                    res.status(200).send({
                        message: 'Missão excluída com sucesso!'
                    });
                }
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        `Erro ao excluir a missão ${id}.`
                });
            });
    }
};
