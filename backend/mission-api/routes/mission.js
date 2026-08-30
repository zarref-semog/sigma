const express = require('express');
const MissionController = require('../controllers/mission');

const router = express.Router();

/**
 * @swagger
 * /api/missions:
 *   post:
 *     summary: Criar uma missão
 *     tags:
 *       - Missions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Mission'
 *     responses:
 *       201:
 *         description: Missão criada com sucesso
 *       500:
 *         description: Internal server error
 */
router.post('/missions', MissionController.create);

/**
 * @swagger
 * /api/missions:
 *   get:
 *     summary: Listar todas as missões
 *     tags:
 *       - Missions
 *     responses:
 *       200:
 *         description: Missões recuperadas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Mission'
 *       500:
 *         description: Internal server error
 */
router.get('/missions', MissionController.findAll);

/**
 * @swagger
 * /api/missions/{id}:
 *   get:
 *     summary: Buscar uma missão pelo ID
 *     tags:
 *       - Missions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da missão
 *     responses:
 *       200:
 *         description: Missão encontrada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Mission'
 *       404:
 *         description: Missão não encontrada
 *       500:
 *         description: Internal server error
 */
router.get('/missions/:id', MissionController.findById);

/**
 * @swagger
 * /api/missions/{id}:
 *   put:
 *     summary: Atualizar uma missão
 *     tags:
 *       - Missions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da missão
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Mission'
 *     responses:
 *       200:
 *         description: Missão atualizada com sucesso
 *       404:
 *         description: Missão não encontrada
 *       500:
 *         description: Internal server error
 */
router.put('/missions/:id', MissionController.update);

/**
 * @swagger
 * /api/missions/{id}:
 *   delete:
 *     summary: Excluir uma missão
 *     tags:
 *       - Missions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da missão
 *     responses:
 *       200:
 *         description: Missão excluída com sucesso
 *       404:
 *         description: Missão não encontrada
 *       500:
 *         description: Internal server error
 */
router.delete('/missions/:id', MissionController.delete);

module.exports = router;
