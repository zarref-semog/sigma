const { Project } = require('../models/project');

module.exports = class ProjectController {

    static async create(req, res) {
        const project = new Project({
            name: req.body.name,
            description: req.body.description,
            backgroundImage: req.body.backgroundImage,
            canvasWidth: req.body.canvasWidth || 920,
            canvasHeight: req.body.canvasHeight || 515,
            interestPointsCount: req.body.interestPointsCount,
            agvsCount: req.body.agvsCount,
            pathsCount: req.body.pathsCount,
            status: req.body.status
        });

        project.save()
            .then(data => {
                res.status(201).send(data);
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        'Erro ao criar o projeto.'
                });
            });
    }

    static async findById(req, res) {
        const { id } = req.params;

        Project.findById(id)
            .then(data => {
                if (!data) {
                    res.status(404).json({
                        message: `Projeto não encontrado para o ID: ${id}`
                    });
                } else {
                    res.status(200).send(data);
                }
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        `Erro ao buscar o projeto ${id}.`
                });
            });
    }

    static async findAll(req, res) {
        Project.find().select('-backgroundImage')
            .then(data => {
                res.status(200).send(data);
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        'Erro ao buscar os projetos.'
                });
            });
    }

    static async update(req, res) {
        const { id } = req.params;

        Project.findByIdAndUpdate(
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
                        message: `Projeto não encontrado para o ID: ${id}`
                    });
                } else {
                    res.status(200).send({
                        message: `Projeto ${id} atualizado com sucesso!`,
                        project: data
                    });
                }
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        `Erro ao atualizar o projeto ${id}.`
                });
            });
    }

    static async delete(req, res) {
        const { id } = req.params;

        Project.findByIdAndDelete(id)
            .then(data => {
                if (!data) {
                    res.status(404).json({
                        message: 'Projeto não encontrado.'
                    });
                } else {
                    res.status(200).send({
                        message: 'Projeto excluído com sucesso!'
                    });
                }
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        `Erro ao excluir o projeto ${id}.`
                });
            });
    }
};
