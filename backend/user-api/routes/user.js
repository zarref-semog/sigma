const express = require('express');
const UserController = require('../controllers/user');

const router = express.Router();

router.post('/auth/login', UserController.login);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Criar um usuário
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/users', UserController.create);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Listar todos os usuários
 *     tags:
 *       - Users
 *     responses:
 *       200:
 *         description: Usuários recuperados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/users', UserController.findAll);

/**
 * @swagger
 * /api/users/email/{email}:
 *   get:
 *     summary: Buscar um usuário pelo e-mail
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: E-mail do usuário
 *     responses:
 *       200:
 *         description: Usuário encontrado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/users/email/:email', UserController.findByEmail);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Atualizar um usuário
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       200:
 *         description: Usuário atualizado com sucesso
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.put('/users/:id', UserController.update);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Excluir um usuário
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Usuário excluído com sucesso
 *       404:
 *         description: Usuário não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.delete('/users/:id', UserController.delete);

module.exports = router;
