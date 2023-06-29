const { Schema, model } = require('mongoose');
const handleMongooseError = require('../helpers/handleMongooseError');

const contactsSchema = Schema(
	{
		name: {
			type: String,
			required: [true, 'Set name for contact']
		},
		email: {
			type: String
		},
		phone: {
			type: String
		},
		favorite: {
			type: Boolean,
			default: false
		},
		avatarURL: {
			type: String
		},
		owner: {
			type: Schema.Types.ObjectId,
			ref: 'user'
		}
	},
	{ versionKey: false }
);

contactsSchema.post('save', handleMongooseError);

const Contacts = model('contact', contactsSchema);

module.exports = Contacts;
