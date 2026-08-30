const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            minlength: 3,
            maxlength: 100,
            trim: true
        },

        description: {
            type: String,
            required: true,
            minlength: 3,
            maxlength: 255,
            trim: true
        },

        backgroundImage: {
            type: String,
            required: true
        },

        canvasWidth: {
            type: Number,
            required: true,
            min: 1
        },

        canvasHeight: {
            type: Number,
            required: true,
            min: 1
        },

        interestPointsCount: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },

        agvsCount: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },

        pathsCount: {
            type: Number,
            required: true,
            min: 0,
            default: 0
        },

        status: {
            type: String,
            required: true,
            enum: [
                'draft',
                'active',
                'completed',
                'archived'
            ],
            default: 'draft'
        }
    },
    {
        timestamps: true
    }
);

const Project = mongoose.model('Project', projectSchema);

module.exports = { Project };
