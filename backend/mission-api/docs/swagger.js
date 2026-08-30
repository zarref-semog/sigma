const swaggerJSDoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',

        info: {
            title: 'Mission API',
            version: '1.0.0',
            description: 'REST API for mission management'
        },

        servers: [
            {
                url: 'http://localhost:3003',
                description: 'Development server'
            }
        ],

        components: {
            schemas: {
                Mission: {
                    type: 'object',

                    required: [
                        'source',
                        'destination',
                        'agv',
                        'priority',
                        'status'
                    ],

                    properties: {
                        id: {
                            type: 'string',
                            description: 'Mission unique identifier',
                            example: '689a123456789'
                        },

                        source: {
                            type: 'string',
                            minLength: 1,
                            maxLength: 100,
                            example: 'Warehouse'
                        },

                        destination: {
                            type: 'string',
                            minLength: 1,
                            maxLength: 100,
                            example: 'SMT Line 01'
                        },

                        agv: {
                            type: 'string',
                            example: 'AGV-001'
                        },

                        priority: {
                            type: 'string',
                            enum: [
                                'Low',
                                'Medium',
                                'High'
                            ],
                            example: 'High'
                        },

                        status: {
                            type: 'string',
                            enum: [
                                'Pending',
                                'In Progress',
                                'Completed',
                                'Cancelled',
                                'Failed'
                            ],
                            example: 'Pending'
                        },

                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                            example: '2026-08-11T23:00:00.000Z'
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
