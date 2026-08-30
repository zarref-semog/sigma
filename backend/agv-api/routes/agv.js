const express = require('express');
const AGVController = require('../controllers/agv');

const router = express.Router();

/**
 * @swagger
 * /api/agvs:
 *   post:
 *     summary: Criar um AGV
 *     tags:
 *       - AGVs
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AGV'
 *     responses:
 *       201:
 *         description: AGV criado com sucesso
 *       500:
 *         description: Internal server error
 */
router.post('/agvs', AGVController.create);

/**
 * @swagger
 * /api/agvs:
 *   get:
 *     summary: Listar todos os AGVs
 *     tags:
 *       - AGVs
 *     responses:
 *       200:
 *         description: AGVs recuperados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AGV'
 *       500:
 *         description: Internal server error
 */
router.get('/agvs', AGVController.findAll);

/**
 * @swagger
 * /api/agvs/{id}:
 *   get:
 *     summary: Buscar um AGV pelo ID
 *     tags:
 *       - AGVs
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do AGV
 *     responses:
 *       200:
 *         description: AGV encontrado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AGV'
 *       404:
 *         description: AGV não encontrado
 *       500:
 *         description: Internal server error
 */
router.get('/agvs/:id', AGVController.findById);

/**
 * @swagger
 * /api/agvs/{id}:
 *   put:
 *     summary: Atualizar um AGV
 *     tags:
 *       - AGVs
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do AGV
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AGV'
 *     responses:
 *       200:
 *         description: AGV atualizado com sucesso
 *       404:
 *         description: AGV não encontrado
 *       500:
 *         description: Internal server error
 */
router.put('/agvs/:id', AGVController.update);

/**
 * @swagger
 * /api/agvs/{id}:
 *   delete:
 *     summary: Excluir um AGV
 *     tags:
 *       - AGVs
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do AGV
 *     responses:
 *       200:
 *         description: AGV excluído com sucesso
 *       404:
 *         description: AGV não encontrado
 *       500:
 *         description: Internal server error
 */
router.delete('/agvs/:id', AGVController.delete);

module.exports = router;
