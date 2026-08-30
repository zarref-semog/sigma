const mongoose = require('mongoose');

const missionSchema = new mongoose.Schema(
    {
        projectId: {
            type: String,
            required: true,
            trim: true
        },

        source: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 100
        },

        sourceName: {
            type: String,
            trim: true,
            maxlength: 100
        },

        destination: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 100
        },

        destinationName: {
            type: String,
            trim: true,
            maxlength: 100
        },

        agv: {
            type: String,
            default: null,
            trim: true
        },

        priority: {
            type: String,
            required: true,
            enum: [
                'Low',
                'Medium',
                'High'
            ],
            default: 'Medium'
        },

        status: {
            type: String,
            required: true,
            enum: [
                'Pending',
                'In Progress',
                'Completed',
                'Cancelled',
                'Failed'
            ],
            default: 'Pending'
        }
    },
    {
        timestamps: {
            createdAt: true,
            updatedAt: false
        }
    }
);

const Mission = mongoose.model('Mission', missionSchema);

module.exports = { Mission };
