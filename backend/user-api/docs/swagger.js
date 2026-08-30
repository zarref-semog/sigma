const swaggerJSDoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',

        info: {
            title: 'User API',
            version: '1.0.0',
            description: 'REST API for user management'
        },

        servers: [
            {
                url: 'http://localhost:3001',
                description: 'Development server'
            }
        ],

        components: {
            schemas: {
                User: {
                    type: 'object',

                    required: [
                        'firstName',
                        'surname',
                        'email',
                        'role'
                    ],

                    properties: {
                        id: {
                            type: 'string',
                            description: 'User unique identifier',
                            example: '689a123456789'
                        },

                        firstName: {
                            type: 'string',
                            minLength: 5,
                            maxLength: 20,
                            example: 'Murilo'
                        },

                        surname: {
                            type: 'string',
                            minLength: 5,
                            maxLength: 20,
                            example: 'Ferraz'
                        },

                        email: {
                            type: 'string',
                            format: 'email',
                            example: 'murilo@example.com'
                        },

                        role: {
                            type: 'string',
                            enum: [
                                'admin',
                                'maintenance',
                                'operator',
                                'designer',
                                'viewer'
                            ],
                            example: 'viewer'
                        },

                        isActive: {
                            type: 'boolean',
                            example: true
                        },

                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            example: '2026-08-11T02:00:00.000Z'
                        },

                        updatedAt: {
                            type: 'string',
                            format: 'date-time',
                            example: '2026-08-11T02:00:00.000Z'
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
