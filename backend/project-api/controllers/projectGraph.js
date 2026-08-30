const mongoose = require('mongoose');
const { driver } = require('../config/graphDb');
const { Project } = require('../models/project');

function serializeProperties(properties) {
  return Object.fromEntries(Object.entries(properties).map(([key, value]) => [
    key,
    neo4jValue(value),
  ]));
}

function neo4jValue(value) {
  if (value && typeof value.toNumber === 'function') return value.toNumber();
  return value;
}

module.exports = class ProjectGraphController {
  static async save(req, res, next) {
    const { project: projectData, backgroundImage, canvasSize, points, routes } = req.body;
    if (!projectData?.name || !projectData?.description || !backgroundImage) {
      return res.status(400).json({ message: 'Nome, descrição e planta baixa do projeto são obrigatórios.' });
    }
    if (!Array.isArray(points) || !Array.isArray(routes)) {
      return res.status(400).json({ message: 'Pontos e rotas devem ser listas.' });
    }
    const normalizedPoints = points.map((point, index) => ({
      ...point,
      rfidTag: String(point.rfidTag || `RFID-${String(index + 1).padStart(3, '0')}`),
      x: Number(point.x),
      y: Number(point.y),
      north: String(point.north || ''),
      south: String(point.south || ''),
      east: String(point.east || ''),
      west: String(point.west || ''),
    }));
    if (normalizedPoints.some((point) => !point.id || !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
      return res.status(400).json({ message: 'Todos os pontos precisam de ID e coordenadas válidas.' });
    }
    if (new Set(normalizedPoints.map((point) => point.rfidTag)).size !== normalizedPoints.length) {
      return res.status(400).json({ message: 'As tags RFID devem ser únicas dentro do projeto.' });
    }
    const pointIds = new Set(normalizedPoints.map((point) => point.id));
    const routeKeys = new Set(routes.flatMap((route) => [`${route.from}::${route.to}`, `${route.to}::${route.from}`]));
    const invalidWaypoint = normalizedPoints.find((point) => point.type === 'waypoint' && !['north', 'south', 'east', 'west'].some((direction) => point[direction]));
    if (invalidWaypoint) return res.status(400).json({ message: `O ponto de rota ${invalidWaypoint.name} precisa ter ao menos uma saída direcional.` });
    const invalidDirection = normalizedPoints.find((point) => ['north', 'south', 'east', 'west'].some((direction) => point[direction] && (!pointIds.has(point[direction]) || !routeKeys.has(`${point.id}::${point[direction]}`))));
    if (invalidDirection) return res.status(400).json({ message: `As saídas de ${invalidDirection.name} devem apontar para pontos diretamente conectados.` });

    const session = driver.session();
    const tx = session.beginTransaction();
    let mongoProject;
    let previousProject;
    let created = false;

    try {
      if (projectData.id) {
        if (!mongoose.isValidObjectId(projectData.id)) {
          return res.status(400).json({ message: 'ID de projeto inválido.' });
        }
        mongoProject = await Project.findById(projectData.id);
        if (!mongoProject) return res.status(404).json({ message: 'Projeto não encontrado.' });
        previousProject = mongoProject.toObject();
        Object.assign(mongoProject, {
          name: projectData.name,
          description: projectData.description,
          backgroundImage,
          canvasWidth: Number(canvasSize?.width || mongoProject.canvasWidth || 920),
          canvasHeight: Number(canvasSize?.height || mongoProject.canvasHeight || 515),
          interestPointsCount: points.length,
          pathsCount: routes.length,
        });
        await mongoProject.save();
      } else {
        mongoProject = await Project.create({
          name: projectData.name,
          description: projectData.description,
          backgroundImage,
          canvasWidth: Number(canvasSize?.width || 920),
          canvasHeight: Number(canvasSize?.height || 515),
          interestPointsCount: points.length,
          pathsCount: routes.length,
          agvsCount: 0,
          status: 'active',
        });
        created = true;
      }

      const projectId = mongoProject.id;
      await tx.run('MATCH (point:InterestPoint {projectId: $projectId}) DETACH DELETE point', { projectId });
      await tx.run(
        `UNWIND $points AS point
         CREATE (:InterestPoint {
           id: point.id,
           projectId: $projectId,
           rfidTag: point.rfidTag,
           name: point.name,
           type: point.type,
           x: point.x,
           y: point.y
           ,north: point.north,
           south: point.south,
           east: point.east,
           west: point.west
         })`,
        { projectId, points: normalizedPoints }
      );
      await tx.run(
        `UNWIND $routes AS route
         MATCH (source:InterestPoint {projectId: $projectId, id: route.from})
         MATCH (target:InterestPoint {projectId: $projectId, id: route.to})
         CREATE (source)-[:ROUTE {id: route.id}]->(target)`,
        { projectId, routes }
      );
      await tx.commit();

      return res.status(created ? 201 : 200).json({
        id: projectId,
        name: mongoProject.name,
        description: mongoProject.description,
        interestPointsCount: points.length,
        pathsCount: routes.length,
        createdAt: mongoProject.createdAt,
        updatedAt: mongoProject.updatedAt,
      });
    } catch (error) {
      await tx.rollback();
      if (mongoProject) {
        if (created) await Project.findByIdAndDelete(mongoProject.id).catch(() => undefined);
        else if (previousProject) await Project.replaceOne({ _id: mongoProject.id }, previousProject).catch(() => undefined);
      }
      return next(error);
    } finally {
      await session.close();
    }
  }

  static async findById(req, res, next) {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'ID de projeto inválido.' });
    }
    const session = driver.session();
    try {
      const project = await Project.findById(req.params.id).lean();
      if (!project) return res.status(404).json({ message: 'Projeto não encontrado.' });
      const projectId = String(project._id);
      const pointResult = await session.run(
        'MATCH (point:InterestPoint {projectId: $projectId}) RETURN point ORDER BY point.name',
        { projectId }
      );
      const routeResult = await session.run(
        `MATCH (source:InterestPoint {projectId: $projectId})-[route:ROUTE]->(target:InterestPoint {projectId: $projectId})
         RETURN route.id AS id, source.id AS sourceId, target.id AS targetId`,
        { projectId }
      );
      const serializedPoints = pointResult.records.map((record, index) => {
        const point = serializeProperties(record.get('point').properties);
        return {
          ...point,
          rfidTag: point.rfidTag || `RFID-${String(index + 1).padStart(3, '0')}`,
        };
      });
      const fallbackWidth = Math.max(920, ...serializedPoints.map((point) => Number(point.x) + 20));
      const fallbackHeight = Math.max(515, ...serializedPoints.map((point) => Number(point.y) + 20));
      return res.json({
        project: {
          id: projectId,
          name: project.name,
          description: project.description,
          backgroundImage: project.backgroundImage,
          canvasWidth: project.canvasWidth || fallbackWidth,
          canvasHeight: project.canvasHeight || fallbackHeight,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
        points: serializedPoints,
        routes: routeResult.records.map((record) => ({
          id: record.get('id'),
          from: record.get('sourceId'),
          to: record.get('targetId'),
        })),
      });
    } catch (error) {
      return next(error);
    } finally {
      await session.close();
    }
  }

  static async findByRfid(req, res, next) {
    const session = driver.session();
    try {
      const result = await session.run(
        `MATCH (point:InterestPoint {projectId: $projectId, rfidTag: $rfidTag})
         RETURN point LIMIT 1`,
        { projectId: req.params.id, rfidTag: req.params.rfidTag }
      );
      if (!result.records.length) return res.status(404).json({ message: 'Ponto RFID não encontrado.' });
      return res.json(serializeProperties(result.records[0].get('point').properties));
    } catch (error) {
      return next(error);
    } finally {
      await session.close();
    }
  }

  static async delete(req, res, next) {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'ID de projeto inválido.' });
    }
    const session = driver.session();
    const tx = session.beginTransaction();
    try {
      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ message: 'Projeto não encontrado.' });
      const projectId = String(project._id);
      await tx.run('MATCH (point:InterestPoint {projectId: $projectId}) DETACH DELETE point', { projectId });
      await Project.findByIdAndDelete(projectId);
      await tx.commit();
      return res.status(200).json({ message: 'Projeto e grafo excluídos com sucesso.' });
    } catch (error) {
      await tx.rollback();
      return next(error);
    } finally {
      await session.close();
    }
  }
};
