const mongoose = require('mongoose');

const agvSchema = new mongoose.Schema(
    {
        projectId: {
            type: String,
            required: true,
            trim: true
        },

        name: {
            type: String,
            required: true,
            minlength: 2,
            maxlength: 100,
            trim: true
        },

        model: {
            type: String,
            required: true,
            minlength: 2,
            maxlength: 100,
            trim: true
        },

        battery: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
            default: 100
        },

        currentMission: {
            type: String,
            default: null,
            trim: true
        },

        location: {
            type: String,
            default: null,
            maxlength: 100,
            trim: true
        },

        status: {
            type: String,
            required: true,
            enum: [
                'Executing Mission',
                'Available',
                'Offline',
                'Charging'
            ],
            default: 'Offline'
        }
    },
    {
        timestamps: false
    }
);

const AGV = mongoose.model('AGV', agvSchema);

module.exports = { AGV };
