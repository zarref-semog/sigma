const express = require('express');
const ProjectController = require('../controllers/project');
const ProjectGraphController = require('../controllers/projectGraph');

const router = express.Router();

router.post('/projects/graph', ProjectGraphController.save);
router.get('/projects/:id/graph', ProjectGraphController.findById);
router.get('/projects/:id/points/rfid/:rfidTag', ProjectGraphController.findByRfid);

/**
 * @swagger
 * /api/projects:
 *   post:
 *     summary: Criar um projeto
 *     tags:
 *       - Projects
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Project'
 *     responses:
 *       201:
 *         description: Projeto criado com sucesso
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/projects', ProjectController.create);

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Listar todos os projetos
 *     tags:
 *       - Projects
 *     responses:
 *       200:
 *         description: Projetos recuperados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Project'
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/projects', ProjectController.findAll);

/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     summary: Buscar um projeto pelo ID
 *     tags:
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do projeto
 *     responses:
 *       200:
 *         description: Projeto encontrado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       404:
 *         description: Projeto não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.get('/projects/:id', ProjectController.findById);

/**
 * @swagger
 * /api/projects/{id}:
 *   put:
 *     summary: Atualizar um projeto
 *     tags:
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do projeto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Project'
 *     responses:
 *       200:
 *         description: Projeto atualizado com sucesso
 *       404:
 *         description: Projeto não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.put('/projects/:id', ProjectController.update);

/**
 * @swagger
 * /api/projects/{id}:
 *   delete:
 *     summary: Excluir um projeto
 *     tags:
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do projeto
 *     responses:
 *       200:
 *         description: Projeto excluído com sucesso
 *       404:
 *         description: Projeto não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.delete('/projects/:id', ProjectGraphController.delete);

module.exports = router;
