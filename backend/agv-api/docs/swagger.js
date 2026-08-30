const swaggerJSDoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',

        info: {
            title: 'AGV API',
            version: '1.0.0',
            description: 'REST API for agv management'
        },

        servers: [
            {
                url: 'http://localhost:3004',
                description: 'Development server'
            }
        ],

        components: {
            schemas: {
                AGV: {
                    type: 'object',

                    required: [
                        'name',
                        'model',
                        'battery',
                        'location',
                        'status'
                    ],

                    properties: {
                        id: {
                            type: 'string',
                            description: 'AGV unique identifier',
                            example: '689a123456789'
                        },

                        name: {
                            type: 'string',
                            minLength: 2,
                            maxLength: 100,
                            example: 'AGV-001'
                        },

                        model: {
                            type: 'string',
                            minLength: 2,
                            maxLength: 100,
                            example: 'MiR250'
                        },

                        battery: {
                            type: 'number',
                            minimum: 0,
                            maximum: 100,
                            example: 87
                        },

                        currentMission: {
                            type: 'string',
                            nullable: true,
                            example: '689a987654321'
                        },

                        location: {
                            type: 'string',
                            minLength: 1,
                            maxLength: 100,
                            example: 'SMT Line 01'
                        },

                        status: {
                            type: 'string',
                            enum: [
                                'Executing Mission',
                                'Available',
                                'Offline',
                                'Charging'
                            ],
                            example: 'Executing Mission'
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
