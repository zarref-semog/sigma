const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 20,
      trim: true
    },

    surname: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 20,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },

    role: {
      type: String,
      required: true,
      enum: ['admin', 'maintenance', 'operator', 'designer', 'viewer']
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.activate = function () {
  if (this.isActive) {
    throw new Error('Este usuário já está ativo.');
  }

  this.isActive = true;
};

userSchema.methods.deactivate = function () {
  if (!this.isActive) {
    throw new Error('Este usuário já está inativo.');
  }

  this.isActive = false;
};

const User = mongoose.model('User', userSchema);

module.exports = { User };
