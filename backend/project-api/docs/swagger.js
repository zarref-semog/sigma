const swaggerJSDoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',

        info: {
            title: 'Project API',
            version: '1.0.0',
            description: 'REST API for project management'
        },

        servers: [
            {
                url: 'http://localhost:3002',
                description: 'Development server'
            }
        ],

        components: {
            schemas: {
                Project: {
                    type: 'object',

                    required: [
                        'name',
                        'description',
                        'interestPointsCount',
                        'agvsCount',
                        'pathsCount',
                        'status'
                    ],

                    properties: {
                        id: {
                            type: 'string',
                            description: 'Project unique identifier',
                            example: '689a123456789'
                        },

                        name: {
                            type: 'string',
                            minLength: 3,
                            maxLength: 100,
                            example: 'SMT Line Project'
                        },

                        description: {
                            type: 'string',
                            minLength: 3,
                            maxLength: 255,
                            example: 'Production routes for SMT line A'
                        },

                        backgroundImage: {
                            type: 'string',
                            description: 'Floor plan image encoded as a data URL'
                        },

                        interestPointsCount: {
                            type: 'integer',
                            minimum: 0,
                            example: 24
                        },

                        agvsCount: {
                            type: 'integer',
                            minimum: 0,
                            example: 7
                        },

                        pathsCount: {
                            type: 'integer',
                            minimum: 0,
                            example: 15
                        },

                        status: {
                            type: 'string',
                            enum: [
                                'draft',
                                'active',
                                'completed',
                                'archived'
                            ],
                            example: 'active'
                        },

                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            example: '2026-08-11T02:00:00.000Z'
                        },

                        updatedAt: {
                            type: 'string',
                            format: 'date-time'
                        }
                    }
                }
            }
        }
    },

    apis: [
        './routes/*.js'
    ]
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
