const express = require('express');
const bcrypt = require('bcryptjs');
const fs = require('fs/promises');
const jwt = require('jsonwebtoken');
const gravatar = require('gravatar');
const jimp = require('jimp');
const path = require('path');

require('dotenv').config();

const { SECRET_KEY } = process.env;

const { HttpError } = require('../../helpers');
const Users = require('../../models/users');
const { emailRegexp } = require('../../constants/users');
const authenticate = require('../../middleware/authenticate');
const upload = require('../../middleware/upload');
const Joi = require('joi');

const avatarDir = path.resolve('public', 'avatars');

const authRouter = express.Router();

const userSignupSchema = Joi.object({
	password: Joi.string().required().min(6),
	email: Joi.string().required().pattern(emailRegexp),
	subscription: Joi.string()
});
const userLoginSchema = Joi.object({
	password: Joi.string().required().min(6),
	email: Joi.string().required().pattern(emailRegexp),
	subscription: Joi.string()
});

authRouter.post('/users/register', async (req, res, next) => {
	try {
		const { email, password } = req.body;
		const user = await Users.findOne({ email });
		if (user) throw HttpError(409, 'email already in use');

		const { error } = userSignupSchema.validate(req.body);
		if (error) throw HttpError(400, error.message);

		const avatarURL = gravatar.url(email, { s: '200', r: 'pg', d: 'mm' });
		const hashPassword = await bcrypt.hash(password, 10);

		const result = await Users.create({
			...req.body,
			password: hashPassword,
			avatarURL
		});

		res.status(201).json({
			email: result.email,
			subscription: result.subscription
		});
	} catch (error) {
		next(error);
	}
});

authRouter.post('/users/login', async (req, res, next) => {
	try {
		const { email: userEmail, password } = req.body;
		const user = await Users.findOne({ email: userEmail });
		if (!user) throw HttpError(400, 'Email or password is wrong');

		const { error } = userLoginSchema.validate(req.body);
		if (error) throw HttpError(400, error.message);

		const passwordCompare = await bcrypt.compare(password, user.password);
		if (!passwordCompare) throw HttpError(400, 'Email or password is wrong');

		const { _id: id, email, subscription } = user;
		const payload = { id };

		const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '23h' });

		await Users.findByIdAndUpdate(id, { token });
		res.json({ token, user: { email, subscription } });
	} catch (error) {
		next(error);
	}
});

authRouter.post('/users/logout', authenticate, async (req, res, next) => {
	try {
		const { _id } = req.user;

		await Users.findByIdAndUpdate(_id, { token: '' });

		res.status(204).json({
			message: 'No Content'
		});
	} catch (error) {
		next(error);
	}
});

authRouter.get('/users/current', authenticate, async (req, res, next) => {
	try {
		const { email, subscription } = req.user;

		res.json({
			email,
			subscription
		});
	} catch (error) {
		next(error);
	}
});

authRouter.patch(
	'/users/subscription',
	authenticate,
	async (req, res, next) => {
		try {
			const { _id, subscription: currentSubscription } = req.user;
			const { newSubscription } = req.body;

			if (currentSubscription !== newSubscription) {
				const validSubscriptions = ['starter', 'pro', 'business'];
				if (validSubscriptions.includes(newSubscription)) {
					await Users.findByIdAndUpdate(_id, { subscription: newSubscription });
					res.json({ newSubscription });
				} else {
					throw HttpError(
						400,
						"Invalid subscription value. Valid options are 'starter', 'pro', or 'business'"
					);
				}
			} else {
				throw HttpError(400, 'This subscription is already in use');
			}
		} catch (error) {
			next(error);
		}
	}
);

authRouter.patch(
	'/users/avatars',
	authenticate,
	upload.single('avatarURL', async (req, res, next) => {
		try {
			// move image
			const { path: oldPath, filename } = req.file;
			const newPath = path.join(avatarDir, filename);
			await fs.rename(oldPath, newPath);
			//
			// resize image
			const image = await jimp.read(newPath);
			await image.resize(250, 250).write(newPath);
			//
			const avatarURL = path.join('avatars', filename);

			req.user.avatarURL = avatarURL;
			res.json(req.user);
		} catch (error) {
			next(error);
		}
	})
);

module.exports = authRouter;
