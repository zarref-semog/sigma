const { User } = require('../models/user');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

module.exports = class UserController {

    static async login(req, res) {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'E-mail e senha são obrigatórios.' });
        }
        try {
            const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
            if (!user || !(await user.comparePassword(password))) {
                return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
            }
            if (!user.isActive) {
                return res.status(403).json({ message: 'Este usuário está inativo.' });
            }
            const token = jwt.sign(
                { sub: user.id, email: user.email, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '8h' }
            );
            return res.status(200).json({
                token,
                user: { id: user.id, firstName: user.firstName, surname: user.surname, email: user.email, role: user.role }
            });
        } catch (error) {
            return res.status(500).json({ message: error.message || 'Erro ao autenticar o usuário.' });
        }
    }

    static async create(req, res) {
        const user = new User({
            firstName: req.body.firstName,
            surname: req.body.surname,
            email: req.body.email,
            password: req.body.password,
            role: req.body.role
        });

        user.save()
            .then(data => {
                res.status(201).send(data);
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        'Erro ao criar o usuário.'
                });
            });
    }

    static async findAll(req, res) {
        User.find()
            .then(data => {
                res.status(200).send(data);
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        'Erro ao buscar os usuários.'
                });
            });
    }

    static async findByEmail(req, res) {
        const { email } = req.params;

        User.findOne({ email })
            .then(data => {
                if (!data) {
                    res.status(404).json({
                        message: `Usuário não encontrado para o e-mail: ${email}`
                    });
                } else {
                    res.status(200).send(data);
                }
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        `Erro ao buscar o usuário pelo e-mail: ${email}`
                });
            });
    }

    static async update(req, res) {
        const { id } = req.params;

        if (req.body.password) req.body.password = await bcrypt.hash(req.body.password, 12);

        User.findByIdAndUpdate(
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
                        message: `Usuário não encontrado para o ID: ${id}`
                    });
                } else {
                    res.status(200).send({
                        message: `Usuário ${id} atualizado com sucesso!`,
                        user: data
                    });
                }
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        `Erro ao atualizar o usuário ${id}.`
                });
            });
    }

    static async delete(req, res) {
        const { id } = req.params;

        User.findByIdAndDelete(id)
            .then(data => {
                if (!data) {
                    res.status(404).json({
                        message: 'Usuário não encontrado.'
                    });
                } else {
                    res.status(200).send({
                        message: 'Usuário excluído com sucesso!'
                    });
                }
            })
            .catch(error => {
                res.status(500).send({
                    message: error.message ||
                        `Erro ao excluir o usuário ${id}.`
                });
            });
    }
};
