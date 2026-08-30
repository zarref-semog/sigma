const { AGV } = require('../models/agv');

module.exports = class AGVController {

    static async create(req, res) {
        const agv = new AGV({
            projectId: req.body.projectId,
            name: req.body.name,
            model: req.body.model,
            status: req.body.status,
            location: req.body.location || null
        });

        try {
            if (agv.location && await AGV.exists({ projectId: agv.projectId, location: agv.location })) {
                return res.status(409).json({ message: 'O ponto selecionado já está ocupado por outro AGV.' });
            }
            return res.status(201).send(await agv.save());
        } catch (error) {
            return res.status(500).send({ message: error.message || 'Erro ao criar o AGV.' });
        }
    }

    static async findById(req, res) {
        const { id } = req.params;

        AGV.findById(id)
            .then(data => {
                if (!data) {
                    res.status(404).json({
                        message: `AGV não encontrado para o ID: ${id}`
                    });
                } else {
                    res.status(200).send(data);
                }
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        `Erro ao buscar o AGV ${id}.`
                });
            });
    }

    static async findAll(req, res) {
        AGV.find()
            .then(data => {
                res.status(200).send(data);
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        'Erro ao buscar os AGVs.'
                });
            });
    }

    static async update(req, res) {
        const { id } = req.params;

        try {
            const current = await AGV.findById(id);
            if (!current) return res.status(404).json({ message: `AGV não encontrado para o ID: ${id}` });
            const projectId = req.body.projectId ?? current.projectId;
            const location = req.body.location === undefined ? current.location : (req.body.location || null);
            if (location && await AGV.exists({ _id: { $ne: id }, projectId, location })) {
                return res.status(409).json({ message: 'O ponto selecionado já está ocupado por outro AGV.' });
            }
            const data = await AGV.findByIdAndUpdate(id, req.body, { returnDocument: 'after', runValidators: true });
            return res.status(200).send({ message: `AGV ${id} atualizado com sucesso!`, agv: data });
        } catch (error) {
            return res.status(500).send({ message: error.message || `Erro ao atualizar o AGV ${id}.` });
        }
    }

    static async delete(req, res) {
        const { id } = req.params;

        AGV.findByIdAndDelete(id)
            .then(data => {
                if (!data) {
                    res.status(404).json({
                        message: 'AGV não encontrado.'
                    });
                } else {
                    res.status(200).send({
                        message: 'AGV excluído com sucesso!'
                    });
                }
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        `Erro ao excluir o AGV ${id}.`
                });
            });
    }
};
