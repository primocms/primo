package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(
		func(app core.App) error {
			jsonData := `[
			{
				"createRule": null,
				"deleteRule": null,
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text455797646",
						"max": 0,
						"min": 0,
						"name": "collectionRef",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text127846527",
						"max": 0,
						"min": 0,
						"name": "recordRef",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1582905952",
						"max": 0,
						"min": 0,
						"name": "method",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": true,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": true,
						"type": "autodate"
					}
				],
				"id": "pbc_2279338944",
				"indexes": [
					"CREATE INDEX ` + "`" + `idx_mfas_collectionRef_recordRef` + "`" + ` ON ` + "`" + `_mfas` + "`" + ` (collectionRef,recordRef)"
				],
				"listRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId",
				"name": "_mfas",
				"system": true,
				"type": "base",
				"updateRule": null,
				"viewRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId"
			},
			{
				"createRule": null,
				"deleteRule": null,
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text455797646",
						"max": 0,
						"min": 0,
						"name": "collectionRef",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text127846527",
						"max": 0,
						"min": 0,
						"name": "recordRef",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"cost": 8,
						"hidden": true,
						"id": "password901924565",
						"max": 0,
						"min": 0,
						"name": "password",
						"pattern": "",
						"presentable": false,
						"required": true,
						"system": true,
						"type": "password"
					},
					{
						"autogeneratePattern": "",
						"hidden": true,
						"id": "text3866985172",
						"max": 0,
						"min": 0,
						"name": "sentTo",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": false,
						"system": true,
						"type": "text"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": true,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": true,
						"type": "autodate"
					}
				],
				"id": "pbc_1638494021",
				"indexes": [
					"CREATE INDEX ` + "`" + `idx_otps_collectionRef_recordRef` + "`" + ` ON ` + "`" + `_otps` + "`" + ` (collectionRef, recordRef)"
				],
				"listRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId",
				"name": "_otps",
				"system": true,
				"type": "base",
				"updateRule": null,
				"viewRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId"
			},
			{
				"createRule": null,
				"deleteRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text455797646",
						"max": 0,
						"min": 0,
						"name": "collectionRef",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text127846527",
						"max": 0,
						"min": 0,
						"name": "recordRef",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text2462348188",
						"max": 0,
						"min": 0,
						"name": "provider",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1044722854",
						"max": 0,
						"min": 0,
						"name": "providerId",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": true,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": true,
						"type": "autodate"
					}
				],
				"id": "pbc_2281828961",
				"indexes": [
					"CREATE UNIQUE INDEX ` + "`" + `idx_externalAuths_record_provider` + "`" + ` ON ` + "`" + `_externalAuths` + "`" + ` (collectionRef, recordRef, provider)",
					"CREATE UNIQUE INDEX ` + "`" + `idx_externalAuths_collection_provider` + "`" + ` ON ` + "`" + `_externalAuths` + "`" + ` (collectionRef, provider, providerId)"
				],
				"listRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId",
				"name": "_externalAuths",
				"system": true,
				"type": "base",
				"updateRule": null,
				"viewRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId"
			},
			{
				"createRule": null,
				"deleteRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text455797646",
						"max": 0,
						"min": 0,
						"name": "collectionRef",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text127846527",
						"max": 0,
						"min": 0,
						"name": "recordRef",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text4228609354",
						"max": 0,
						"min": 0,
						"name": "fingerprint",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": true,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": true,
						"type": "autodate"
					}
				],
				"id": "pbc_4275539003",
				"indexes": [
					"CREATE UNIQUE INDEX ` + "`" + `idx_authOrigins_unique_pairs` + "`" + ` ON ` + "`" + `_authOrigins` + "`" + ` (collectionRef, recordRef, fingerprint)"
				],
				"listRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId",
				"name": "_authOrigins",
				"system": true,
				"type": "base",
				"updateRule": null,
				"viewRule": "@request.auth.id != '' && recordRef = @request.auth.id && collectionRef = @request.auth.collectionId"
			},
			{
				"authAlert": {
					"emailTemplate": {
						"body": "<p>Hello,</p>\n<p>We noticed a login to your {APP_NAME} account from a new location.</p>\n<p>If this was you, you may disregard this email.</p>\n<p><strong>If this wasn't you, you should immediately change your {APP_NAME} account password to revoke access from all other locations.</strong></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
						"subject": "Login from a new location"
					},
					"enabled": true
				},
				"authRule": "",
				"authToken": {
					"duration": 86400
				},
				"confirmEmailChangeTemplate": {
					"body": "<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Confirm new email</a>\n</p>\n<p><i>If you didn't ask to change your email address, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
					"subject": "Confirm your {APP_NAME} new email address"
				},
				"createRule": null,
				"deleteRule": null,
				"emailChangeToken": {
					"duration": 1800
				},
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"cost": 0,
						"hidden": true,
						"id": "password901924565",
						"max": 0,
						"min": 8,
						"name": "password",
						"pattern": "",
						"presentable": false,
						"required": true,
						"system": true,
						"type": "password"
					},
					{
						"autogeneratePattern": "[a-zA-Z0-9]{50}",
						"hidden": true,
						"id": "text2504183744",
						"max": 60,
						"min": 30,
						"name": "tokenKey",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"exceptDomains": null,
						"hidden": false,
						"id": "email3885137012",
						"name": "email",
						"onlyDomains": null,
						"presentable": false,
						"required": true,
						"system": true,
						"type": "email"
					},
					{
						"hidden": false,
						"id": "bool1547992806",
						"name": "emailVisibility",
						"presentable": false,
						"required": false,
						"system": true,
						"type": "bool"
					},
					{
						"hidden": false,
						"id": "bool256245529",
						"name": "verified",
						"presentable": false,
						"required": false,
						"system": true,
						"type": "bool"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": true,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": true,
						"type": "autodate"
					}
				],
				"fileToken": {
					"duration": 180
				},
				"id": "pbc_3142635823",
				"indexes": [
					"CREATE UNIQUE INDEX ` + "`" + `idx_tokenKey_pbc_3142635823` + "`" + ` ON ` + "`" + `_superusers` + "`" + ` (` + "`" + `tokenKey` + "`" + `)",
					"CREATE UNIQUE INDEX ` + "`" + `idx_email_pbc_3142635823` + "`" + ` ON ` + "`" + `_superusers` + "`" + ` (` + "`" + `email` + "`" + `) WHERE ` + "`" + `email` + "`" + ` != ''"
				],
				"listRule": null,
				"manageRule": null,
				"mfa": {
					"duration": 1800,
					"enabled": false,
					"rule": ""
				},
				"name": "_superusers",
				"oauth2": {
					"enabled": false,
					"mappedFields": {
						"avatarURL": "",
						"id": "",
						"name": "",
						"username": ""
					}
				},
				"otp": {
					"duration": 180,
					"emailTemplate": {
						"body": "<p>Hello,</p>\n<p>Your one-time password is: <strong>{OTP}</strong></p>\n<p><i>If you didn't ask for the one-time password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
						"subject": "OTP for {APP_NAME}"
					},
					"enabled": false,
					"length": 8
				},
				"passwordAuth": {
					"enabled": true,
					"identityFields": [
						"email"
					]
				},
				"passwordResetToken": {
					"duration": 1800
				},
				"resetPasswordTemplate": {
					"body": "<p>Hello,</p>\n<p>Click on the button below to reset your password.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Reset password</a>\n</p>\n<p><i>If you didn't ask to reset your password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
					"subject": "Reset your {APP_NAME} password"
				},
				"system": true,
				"type": "auth",
				"updateRule": null,
				"verificationTemplate": {
					"body": "<p>Hello,</p>\n<p>Thank you for joining us at {APP_NAME}.</p>\n<p>Click on the button below to verify your email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-verification/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Verify</a>\n</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
					"subject": "Verify your {APP_NAME} email"
				},
				"verificationToken": {
					"duration": 259200
				},
				"viewRule": null
			},
			{
				"authAlert": {
					"emailTemplate": {
						"body": "<p>Hello,</p>\n<p>We noticed a login to your {APP_NAME} account from a new location.</p>\n<p>If this was you, you may disregard this email.</p>\n<p><strong>If this wasn't you, you should immediately change your {APP_NAME} account password to revoke access from all other locations.</strong></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
						"subject": "Login from a new location"
					},
					"enabled": true
				},
				"authRule": "",
				"authToken": {
					"duration": 604800
				},
				"confirmEmailChangeTemplate": {
					"body": "<p>Hello,</p>\n<p>Click on the button below to confirm your new email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Confirm new email</a>\n</p>\n<p><i>If you didn't ask to change your email address, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
					"subject": "Confirm your {APP_NAME} new email address"
				},
				"createRule": "@request.auth.serverRole != ''",
				"deleteRule": "@request.auth.serverRole != '' || id = @request.auth.id",
				"emailChangeToken": {
					"duration": 1800
				},
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"cost": 0,
						"hidden": true,
						"id": "password901924565",
						"max": 0,
						"min": 8,
						"name": "password",
						"pattern": "",
						"presentable": false,
						"required": true,
						"system": true,
						"type": "password"
					},
					{
						"autogeneratePattern": "[a-zA-Z0-9]{50}",
						"hidden": true,
						"id": "text2504183744",
						"max": 60,
						"min": 30,
						"name": "tokenKey",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"exceptDomains": null,
						"hidden": false,
						"id": "email3885137012",
						"name": "email",
						"onlyDomains": null,
						"presentable": false,
						"required": true,
						"system": true,
						"type": "email"
					},
					{
						"hidden": true,
						"id": "bool1547992806",
						"name": "emailVisibility",
						"presentable": false,
						"required": false,
						"system": true,
						"type": "bool"
					},
					{
						"hidden": true,
						"id": "bool256245529",
						"name": "verified",
						"presentable": false,
						"required": false,
						"system": true,
						"type": "bool"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1579384326",
						"max": 255,
						"min": 0,
						"name": "name",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"hidden": false,
						"id": "select1466534506",
						"maxSelect": 1,
						"name": "serverRole",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "select",
						"values": [
							"editor",
							"developer"
						]
					},
					{
						"hidden": false,
						"id": "select3353481431",
						"maxSelect": 1,
						"name": "invite",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "select",
						"values": [
							"pending",
							"sent"
						]
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"fileToken": {
					"duration": 180
				},
				"id": "_pb_users_auth_",
				"indexes": [
					"CREATE UNIQUE INDEX ` + "`" + `idx_tokenKey__pb_users_auth_` + "`" + ` ON ` + "`" + `users` + "`" + ` (` + "`" + `tokenKey` + "`" + `)",
					"CREATE UNIQUE INDEX ` + "`" + `idx_email__pb_users_auth_` + "`" + ` ON ` + "`" + `users` + "`" + ` (` + "`" + `email` + "`" + `) WHERE ` + "`" + `email` + "`" + ` != ''"
				],
				"listRule": "@request.auth.serverRole != '' || id = @request.auth.id",
				"manageRule": "@request.auth.serverRole != ''",
				"mfa": {
					"duration": 1800,
					"enabled": false,
					"rule": ""
				},
				"name": "users",
				"oauth2": {
					"enabled": false,
					"mappedFields": {
						"avatarURL": "",
						"id": "",
						"name": "name",
						"username": ""
					}
				},
				"otp": {
					"duration": 180,
					"emailTemplate": {
						"body": "<p>Hello,</p>\n<p>Your one-time password is: <strong>{OTP}</strong></p>\n<p><i>If you didn't ask for the one-time password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
						"subject": "OTP for {APP_NAME}"
					},
					"enabled": false,
					"length": 8
				},
				"passwordAuth": {
					"enabled": true,
					"identityFields": [
						"email"
					]
				},
				"passwordResetToken": {
					"duration": 2592000
				},
				"resetPasswordTemplate": {
					"body": "<p>Hello,</p>\n<p>Click on the button below to reset your password.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/admin/auth?reset={TOKEN}\" target=\"_blank\" rel=\"noopener\">Reset password</a>\n</p>\n<p><i>If you didn't ask to reset your password, you can ignore this email.</i></p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
					"subject": "Reset your {APP_NAME} password"
				},
				"system": false,
				"type": "auth",
				"updateRule": "@request.auth.serverRole != ''",
				"verificationTemplate": {
					"body": "<p>Hello,</p>\n<p>Thank you for joining us at {APP_NAME}.</p>\n<p>Click on the button below to verify your email address.</p>\n<p>\n  <a class=\"btn\" href=\"{APP_URL}/_/#/auth/confirm-verification/{TOKEN}\" target=\"_blank\" rel=\"noopener\">Verify</a>\n</p>\n<p>\n  Thanks,<br/>\n  {APP_NAME} team\n</p>",
					"subject": "Verify your {APP_NAME} email"
				},
				"verificationToken": {
					"duration": 259200
				},
				"viewRule": "@request.auth.serverRole != '' || id = @request.auth.id"
			},
			{
				"createRule": "@request.auth.serverRole != \"\"",
				"deleteRule": "@request.auth.serverRole != \"\"",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1579384326",
						"max": 0,
						"min": 0,
						"name": "name",
						"pattern": "",
						"presentable": true,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"hidden": false,
						"id": "number2155046657",
						"max": null,
						"min": 0,
						"name": "index",
						"onlyInt": true,
						"presentable": false,
						"required": false,
						"system": false,
						"type": "number"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_1192439887",
				"indexes": [
					"CREATE UNIQUE INDEX ` + "`" + `idx_q2lOPpX7Th` + "`" + ` ON ` + "`" + `site_groups` + "`" + ` (` + "`" + `name` + "`" + `)"
				],
				"listRule": "@request.auth.serverRole != \"\"",
				"name": "site_groups",
				"system": false,
				"type": "base",
				"updateRule": "@request.auth.serverRole != \"\"",
				"viewRule": "@request.auth.serverRole != \"\""
			},
			{
				"createRule": "@request.auth.serverRole != \"\"",
				"deleteRule": "@request.auth.serverRole != \"\"",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1579384326",
						"max": 0,
						"min": 0,
						"name": "name",
						"pattern": "",
						"presentable": true,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1843675174",
						"max": 0,
						"min": 0,
						"name": "description",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text3475444733",
						"max": 0,
						"min": 0,
						"name": "host",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_1192439887",
						"hidden": false,
						"id": "relation1841317061",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "group",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text2817783452",
						"max": 0,
						"min": 0,
						"name": "head",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text3381606803",
						"max": 0,
						"min": 0,
						"name": "foot",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"hidden": false,
						"id": "file3112513328",
						"maxSelect": 1,
						"maxSize": 0,
						"mimeTypes": [],
						"name": "preview",
						"presentable": false,
						"protected": false,
						"required": false,
						"system": false,
						"thumbs": [],
						"type": "file"
					},
					{
						"hidden": false,
						"id": "number2155046657",
						"max": null,
						"min": 0,
						"name": "index",
						"onlyInt": true,
						"presentable": false,
						"required": false,
						"system": false,
						"type": "number"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_2001081480",
				"indexes": [
					"CREATE UNIQUE INDEX ` + "`" + `idx_ivHryyog5w` + "`" + ` ON ` + "`" + `sites` + "`" + ` (\n  ` + "`" + `name` + "`" + `,\n  ` + "`" + `group` + "`" + `\n)",
					"CREATE UNIQUE INDEX ` + "`" + `idx_r0T0jyPOdd` + "`" + ` ON ` + "`" + `sites` + "`" + ` (` + "`" + `host` + "`" + `)"
				],
				"listRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = id)",
				"name": "sites",
				"system": false,
				"type": "base",
				"updateRule": "@request.auth.serverRole != \"\"",
				"viewRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = id)"
			},
			{
				"createRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)",
				"deleteRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text2324736937",
						"max": 0,
						"min": 0,
						"name": "key",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text245846248",
						"max": 0,
						"min": 0,
						"name": "label",
						"pattern": "",
						"presentable": true,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text2363381545",
						"max": 0,
						"min": 0,
						"name": "type",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_2001081480",
						"hidden": false,
						"id": "relation1766001124",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "site",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "json3565825916",
						"maxSize": 0,
						"name": "config",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "json"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_4273630883",
						"hidden": false,
						"id": "relation_parent_field",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "parent",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "number_index_field",
						"max": null,
						"min": 0,
						"name": "index",
						"onlyInt": true,
						"presentable": false,
						"required": false,
						"system": false,
						"type": "number"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_4273630883",
				"indexes": [
					"CREATE UNIQUE INDEX ` + "`" + `idx_kzYPeLM7lh` + "`" + ` ON ` + "`" + `site_fields` + "`" + ` (\n  ` + "`" + `key` + "`" + `,\n  ` + "`" + `site` + "`" + `,\n  ` + "`" + `parent` + "`" + `\n)"
				],
				"listRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)",
				"name": "site_fields",
				"system": false,
				"type": "base",
				"updateRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)",
				"viewRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)"
			},
			{
				"createRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = field.site.id)",
				"deleteRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = field.site.id)",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1098958488",
						"max": 0,
						"min": 0,
						"name": "locale",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_4273630883",
						"hidden": false,
						"id": "relation1542800728",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "field",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_298548709",
						"hidden": false,
						"id": "relation1032740943",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "parent",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "number2155046657",
						"max": null,
						"min": 0,
						"name": "index",
						"onlyInt": true,
						"presentable": false,
						"required": false,
						"system": false,
						"type": "number"
					},
					{
						"hidden": false,
						"id": "json494360628",
						"maxSize": 0,
						"name": "value",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "json"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_298548709",
				"indexes": [],
				"listRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = field.site.id)",
				"name": "site_entries",
				"system": false,
				"type": "base",
				"updateRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = field.site.id)",
				"viewRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = field.site.id)"
			},
			{
				"createRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)",
				"deleteRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1579384326",
						"max": 0,
						"min": 0,
						"name": "name",
						"pattern": "",
						"presentable": true,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text398963028",
						"max": 0,
						"min": 0,
						"name": "js",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text2026809048",
						"max": 0,
						"min": 0,
						"name": "css",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text410646757",
						"max": 0,
						"min": 0,
						"name": "html",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_2001081480",
						"hidden": false,
						"id": "relation1766001124",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "site",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "file911310099",
						"maxSelect": 1,
						"maxSize": 0,
						"mimeTypes": [],
						"name": "compiled_js",
						"presentable": false,
						"protected": false,
						"required": false,
						"system": false,
						"thumbs": [],
						"type": "file"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_1322267247",
				"indexes": [
					"CREATE INDEX ` + "`" + `idx_bP8ZfDMEWA` + "`" + ` ON ` + "`" + `site_symbols` + "`" + ` (\n  ` + "`" + `name` + "`" + `,\n  ` + "`" + `site` + "`" + `\n)"
				],
				"listRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)",
				"name": "site_symbols",
				"system": false,
				"type": "base",
				"updateRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)",
				"viewRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)"
			},
			{
				"createRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = symbol.site.id)",
				"deleteRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = symbol.site.id)",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text2324736937",
						"max": 0,
						"min": 0,
						"name": "key",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text245846248",
						"max": 0,
						"min": 0,
						"name": "label",
						"pattern": "",
						"presentable": true,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text2363381545",
						"max": 0,
						"min": 0,
						"name": "type",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_1322267247",
						"hidden": false,
						"id": "relation3972544249",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "symbol",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "json3565825916",
						"maxSize": 0,
						"name": "config",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "json"
					},
					{
						"hidden": false,
						"id": "number2155046657",
						"max": null,
						"min": 0,
						"name": "index",
						"onlyInt": true,
						"presentable": false,
						"required": false,
						"system": false,
						"type": "number"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_149684058",
						"hidden": false,
						"id": "relation1234567890",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "parent",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_149684058",
				"indexes": [
					"CREATE UNIQUE INDEX ` + "`" + `idx_FAyFVAS8Jh` + "`" + ` ON ` + "`" + `site_symbol_fields` + "`" + ` (\n  ` + "`" + `key` + "`" + `,\n  ` + "`" + `symbol` + "`" + `,\n  ` + "`" + `parent` + "`" + `\n)"
				],
				"listRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = symbol.site.id)",
				"name": "site_symbol_fields",
				"system": false,
				"type": "base",
				"updateRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = symbol.site.id)",
				"viewRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = symbol.site.id)"
			},
			{
				"createRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = field.symbol.site.id)",
				"deleteRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = field.symbol.site.id)",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1098958488",
						"max": 0,
						"min": 0,
						"name": "locale",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_149684058",
						"hidden": false,
						"id": "relation1542800728",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "field",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_1163071009",
						"hidden": false,
						"id": "relation1032740943",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "parent",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "number2155046657",
						"max": null,
						"min": 0,
						"name": "index",
						"onlyInt": true,
						"presentable": false,
						"required": false,
						"system": false,
						"type": "number"
					},
					{
						"hidden": false,
						"id": "json494360628",
						"maxSize": 0,
						"name": "value",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "json"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_1163071009",
				"indexes": [],
				"listRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = field.symbol.site.id)",
				"name": "site_symbol_entries",
				"system": false,
				"type": "base",
				"updateRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = field.symbol.site.id)",
				"viewRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = field.symbol.site.id)"
			},
			{
				"createRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)",
				"deleteRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1579384326",
						"max": 0,
						"min": 0,
						"name": "name",
						"pattern": "",
						"presentable": true,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text2817783452",
						"max": 0,
						"min": 0,
						"name": "head",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text3381606803",
						"max": 0,
						"min": 0,
						"name": "foot",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1716930793",
						"max": 0,
						"min": 0,
						"name": "color",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1704208859",
						"max": 0,
						"min": 0,
						"name": "icon",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_2001081480",
						"hidden": false,
						"id": "relation1766001124",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "site",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_3238086262",
				"indexes": [
					"CREATE INDEX ` + "`" + `idx_4dEr2JY3h7` + "`" + ` ON ` + "`" + `page_types` + "`" + ` (\n  ` + "`" + `name` + "`" + `,\n  ` + "`" + `site` + "`" + `\n)"
				],
				"listRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)",
				"name": "page_types",
				"system": false,
				"type": "base",
				"updateRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)",
				"viewRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)"
			},
			{
				"createRule": "(symbol.site.id = page_type.site.id) && ((@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page_type.site.id))",
				"deleteRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page_type.site.id)",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_3238086262",
						"hidden": false,
						"id": "relation186272755",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "page_type",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_1322267247",
						"hidden": false,
						"id": "relation3972544249",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "symbol",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_3564279343",
				"indexes": [
					"CREATE UNIQUE INDEX ` + "`" + `idx_6lGEJ55d9O` + "`" + ` ON ` + "`" + `page_type_symbols` + "`" + ` (\n  ` + "`" + `page_type` + "`" + `,\n  ` + "`" + `symbol` + "`" + `\n)"
				],
				"listRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page_type.site.id)",
				"name": "page_type_symbols",
				"system": false,
				"type": "base",
				"updateRule": "(symbol.site.id = page_type.site.id) && ((@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page_type.site.id))",
				"viewRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page_type.site.id)"
			},
			{
				"createRule": "(symbol.site.id = page_type.site.id) && ((@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page_type.site.id))",
				"deleteRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page_type.site.id)",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_3238086262",
						"hidden": false,
						"id": "relation186272755",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "page_type",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_1322267247",
						"hidden": false,
						"id": "relation3972544249",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "symbol",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "number2155046657",
						"max": null,
						"min": 0,
						"name": "index",
						"onlyInt": true,
						"presentable": false,
						"required": false,
						"system": false,
						"type": "number"
					},
					{
						"hidden": false,
						"id": "select2699804679",
						"maxSelect": 1,
						"name": "zone",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "select",
						"values": [
							"header",
							"body",
							"footer"
						]
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_496957621",
				"indexes": [
					"CREATE UNIQUE INDEX ` + "`" + `idx_18mJGVnXFu` + "`" + ` ON ` + "`" + `page_type_sections` + "`" + ` (\n  ` + "`" + `page_type` + "`" + `,\n  ` + "`" + `index` + "`" + `,\n  ` + "`" + `zone` + "`" + `\n)"
				],
				"listRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page_type.site.id)",
				"name": "page_type_sections",
				"system": false,
				"type": "base",
				"updateRule": "(symbol.site.id = page_type.site.id) && ((@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page_type.site.id))",
				"viewRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page_type.site.id)"
			},
			{
				"createRule": "(field.symbol.id = section.symbol.id) && ((@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = section.symbol.site.id))",
				"deleteRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = section.symbol.site.id)",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1098958488",
						"max": 0,
						"min": 0,
						"name": "locale",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_496957621",
						"hidden": false,
						"id": "relation3142498644",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "section",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_149684058",
						"hidden": false,
						"id": "relation3727704862",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "field",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_3303549340",
						"hidden": false,
						"id": "relation1032740943",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "parent",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "number2155046657",
						"max": null,
						"min": 0,
						"name": "index",
						"onlyInt": true,
						"presentable": false,
						"required": false,
						"system": false,
						"type": "number"
					},
					{
						"hidden": false,
						"id": "json494360628",
						"maxSize": 0,
						"name": "value",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "json"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_3303549340",
				"indexes": [],
				"listRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = section.symbol.site.id)",
				"name": "page_type_section_entries",
				"system": false,
				"type": "base",
				"updateRule": "(field.symbol.id = section.symbol.id) && ((@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = section.symbol.site.id))",
				"viewRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = section.symbol.site.id)"
			},
			{
				"createRule": "(page_type.site.id = site.id && (parent = \"\" || parent.site.id = site.id)) && ((@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id))",
				"deleteRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1579384326",
						"max": 0,
						"min": 0,
						"name": "name",
						"pattern": "",
						"presentable": true,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text2560465762",
						"max": 0,
						"min": 0,
						"name": "slug",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"hidden": false,
						"id": "file898862634",
						"maxSelect": 1,
						"maxSize": 0,
						"mimeTypes": [
							"text/html"
						],
						"name": "compiled_html",
						"presentable": false,
						"protected": false,
						"required": false,
						"system": false,
						"thumbs": [],
						"type": "file"
					},
					{
						"cascadeDelete": false,
						"collectionId": "pbc_3238086262",
						"hidden": false,
						"id": "relation186272755",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "page_type",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_3945946014",
						"hidden": false,
						"id": "relation1032740943",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "parent",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_2001081480",
						"hidden": false,
						"id": "relation1766001124",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "site",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "index_field_123456",
						"max": null,
						"min": 0,
						"name": "index",
						"onlyInt": true,
						"presentable": false,
						"required": false,
						"system": false,
						"type": "number"
					}
				],
				"id": "pbc_3945946014",
				"indexes": [],
				"listRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)",
				"name": "pages",
				"system": false,
				"type": "base",
				"updateRule": "(page_type.site.id = site.id && (parent = \"\" || parent.site.id = site.id)) && ((@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id))",
				"viewRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)"
			},
			{
				"createRule": "(symbol.site.id = page.site.id) && ((@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = symbol.site.id))",
				"deleteRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = symbol.site.id)",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_3945946014",
						"hidden": false,
						"id": "relation336246304",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "page",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_1322267247",
						"hidden": false,
						"id": "relation3972544249",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "symbol",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "number2155046657",
						"max": null,
						"min": 0,
						"name": "index",
						"onlyInt": true,
						"presentable": false,
						"required": false,
						"system": false,
						"type": "number"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_1111325129",
				"indexes": [
					"CREATE INDEX ` + "`" + `idx_17WMSNScHZ` + "`" + ` ON ` + "`" + `page_sections` + "`" + ` (\n  ` + "`" + `page` + "`" + `,\n  ` + "`" + `index` + "`" + `\n)"
				],
				"listRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = symbol.site.id)",
				"name": "page_sections",
				"system": false,
				"type": "base",
				"updateRule": "(symbol.site.id = page.site.id) && ((@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = symbol.site.id))",
				"viewRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = symbol.site.id)"
			},
			{
				"createRule": "(field.symbol.id = section.symbol.id) && ((@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = section.page.site.id))",
				"deleteRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = section.page.site.id)",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1098958488",
						"max": 0,
						"min": 0,
						"name": "locale",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_1111325129",
						"hidden": false,
						"id": "relation3608383866",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "section",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_149684058",
						"hidden": false,
						"id": "relation3727704862",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "field",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_2653269516",
						"hidden": false,
						"id": "relation1032740943",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "parent",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "number2155046657",
						"max": null,
						"min": 0,
						"name": "index",
						"onlyInt": true,
						"presentable": false,
						"required": false,
						"system": false,
						"type": "number"
					},
					{
						"hidden": false,
						"id": "json494360628",
						"maxSize": 0,
						"name": "value",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "json"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_2653269516",
				"indexes": [],
				"listRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = section.page.site.id)",
				"name": "page_section_entries",
				"system": false,
				"type": "base",
				"updateRule": "(field.symbol.id = section.symbol.id) && ((@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = section.page.site.id))",
				"viewRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = section.page.site.id)"
			},
			{
				"createRule": "@request.auth.serverRole != \"\"",
				"deleteRule": "@request.auth.serverRole != \"\"",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1579384326",
						"max": 0,
						"min": 0,
						"name": "name",
						"pattern": "",
						"presentable": true,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"hidden": false,
						"id": "number2155046657",
						"max": null,
						"min": 0,
						"name": "index",
						"onlyInt": true,
						"presentable": false,
						"required": false,
						"system": false,
						"type": "number"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_3479997895",
				"indexes": [
					"CREATE UNIQUE INDEX ` + "`" + `idx_NbjcYI8OY4` + "`" + ` ON ` + "`" + `library_symbol_groups` + "`" + ` (` + "`" + `name` + "`" + `)"
				],
				"listRule": "@request.auth.serverRole != \"\"",
				"name": "library_symbol_groups",
				"system": false,
				"type": "base",
				"updateRule": "@request.auth.serverRole != \"\"",
				"viewRule": "@request.auth.serverRole != \"\""
			},
			{
				"createRule": "@request.auth.serverRole != \"\"",
				"deleteRule": "@request.auth.serverRole != \"\"",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1579384326",
						"max": 0,
						"min": 0,
						"name": "name",
						"pattern": "",
						"presentable": true,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text398963028",
						"max": 0,
						"min": 0,
						"name": "js",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text2026809048",
						"max": 0,
						"min": 0,
						"name": "css",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text410646757",
						"max": 0,
						"min": 0,
						"name": "html",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_3479997895",
						"hidden": false,
						"id": "relation3563057531",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "group",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_3406698535",
				"indexes": [
					"CREATE INDEX ` + "`" + `idx_GYqoayJsVW` + "`" + ` ON ` + "`" + `library_symbols` + "`" + ` (\n  ` + "`" + `name` + "`" + `,\n  ` + "`" + `group` + "`" + `\n)"
				],
				"listRule": "@request.auth.serverRole != \"\"",
				"name": "library_symbols",
				"system": false,
				"type": "base",
				"updateRule": "@request.auth.serverRole != \"\"",
				"viewRule": "@request.auth.serverRole != \"\""
			},
			{
				"createRule": "@request.auth.serverRole != \"\"",
				"deleteRule": "@request.auth.serverRole != \"\"",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text2324736937",
						"max": 0,
						"min": 0,
						"name": "key",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text245846248",
						"max": 0,
						"min": 0,
						"name": "label",
						"pattern": "",
						"presentable": true,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text2363381545",
						"max": 0,
						"min": 0,
						"name": "type",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_3406698535",
						"hidden": false,
						"id": "relation1193979506",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "symbol",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_1105483583",
						"hidden": false,
						"id": "relation1032740943",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "parent",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "json3565825916",
						"maxSize": 0,
						"name": "config",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "json"
					},
					{
						"hidden": false,
						"id": "number2155046657",
						"max": null,
						"min": 0,
						"name": "index",
						"onlyInt": true,
						"presentable": false,
						"required": false,
						"system": false,
						"type": "number"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_1105483583",
				"indexes": [
					"CREATE UNIQUE INDEX ` + "`" + `idx_jOU36yKglP` + "`" + ` ON ` + "`" + `library_symbol_fields` + "`" + ` (\n  ` + "`" + `key` + "`" + `,\n  ` + "`" + `symbol` + "`" + `,\n  ` + "`" + `parent` + "`" + `\n)"
				],
				"listRule": "@request.auth.serverRole != \"\"",
				"name": "library_symbol_fields",
				"system": false,
				"type": "base",
				"updateRule": "@request.auth.serverRole != \"\"",
				"viewRule": "@request.auth.serverRole != \"\""
			},
			{
				"createRule": "@request.auth.serverRole != \"\"",
				"deleteRule": "@request.auth.serverRole != \"\"",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1098958488",
						"max": 0,
						"min": 0,
						"name": "locale",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_1105483583",
						"hidden": false,
						"id": "relation3798659302",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "field",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_2026017886",
						"hidden": false,
						"id": "relation1032740943",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "parent",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "number2155046657",
						"max": null,
						"min": 0,
						"name": "index",
						"onlyInt": true,
						"presentable": false,
						"required": false,
						"system": false,
						"type": "number"
					},
					{
						"hidden": false,
						"id": "json494360628",
						"maxSize": 0,
						"name": "value",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "json"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_2026017886",
				"indexes": [],
				"listRule": "@request.auth.serverRole != \"\"",
				"name": "library_symbol_entries",
				"system": false,
				"type": "base",
				"updateRule": "@request.auth.serverRole != \"\"",
				"viewRule": "@request.auth.serverRole != \"\""
			},
			{
				"createRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page_type.site.id)",
				"deleteRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page_type.site.id)",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text2324736937",
						"max": 0,
						"min": 0,
						"name": "key",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text245846248",
						"max": 0,
						"min": 0,
						"name": "label",
						"pattern": "",
						"presentable": true,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text2363381545",
						"max": 0,
						"min": 0,
						"name": "type",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_3238086262",
						"hidden": false,
						"id": "relation186272755",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "page_type",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_1424058439",
						"hidden": false,
						"id": "relation1032740943",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "parent",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "json3565825916",
						"maxSize": 0,
						"name": "config",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "json"
					},
					{
						"hidden": false,
						"id": "number2155046657",
						"max": null,
						"min": 0,
						"name": "index",
						"onlyInt": true,
						"presentable": false,
						"required": false,
						"system": false,
						"type": "number"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_1424058439",
				"indexes": [
					"CREATE UNIQUE INDEX ` + "`" + `idx_SCEvSMYGvw` + "`" + ` ON ` + "`" + `page_type_fields` + "`" + ` (\n  ` + "`" + `key` + "`" + `,\n  ` + "`" + `page_type` + "`" + `,\n  ` + "`" + `parent` + "`" + `\n)"
				],
				"listRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page_type.site.id)",
				"name": "page_type_fields",
				"system": false,
				"type": "base",
				"updateRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page_type.site.id)",
				"viewRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page_type.site.id)"
			},
			{
				"createRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = field.page_type.site.id)",
				"deleteRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = field.page_type.site.id)",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1098958488",
						"max": 0,
						"min": 0,
						"name": "locale",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_1424058439",
						"hidden": false,
						"id": "relation1542800728",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "field",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_638150767",
						"hidden": false,
						"id": "relation1032740943",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "parent",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "number2155046657",
						"max": null,
						"min": 0,
						"name": "index",
						"onlyInt": true,
						"presentable": false,
						"required": false,
						"system": false,
						"type": "number"
					},
					{
						"hidden": false,
						"id": "json494360628",
						"maxSize": 0,
						"name": "value",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "json"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_638150767",
				"indexes": [],
				"listRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = field.page_type.site.id)",
				"name": "page_type_entries",
				"system": false,
				"type": "base",
				"updateRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = field.page_type.site.id)",
				"viewRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = field.page_type.site.id)"
			},
			{
				"createRule": "(field.page_type.id = page.page_type) && ((@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page.site.id))",
				"deleteRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page.site.id)",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text1098958488",
						"max": 0,
						"min": 0,
						"name": "locale",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": true,
						"system": false,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_3945946014",
						"hidden": false,
						"id": "relation336246304",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "page",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_1424058439",
						"hidden": false,
						"id": "relation1542800728",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "field",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_2147490902",
						"hidden": false,
						"id": "relation1032740943",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "parent",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "number2155046657",
						"max": null,
						"min": 0,
						"name": "index",
						"onlyInt": true,
						"presentable": false,
						"required": false,
						"system": false,
						"type": "number"
					},
					{
						"hidden": false,
						"id": "json494360628",
						"maxSize": 0,
						"name": "value",
						"presentable": false,
						"required": false,
						"system": false,
						"type": "json"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_2147490902",
				"indexes": [],
				"listRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page.site.id)",
				"name": "page_entries",
				"system": false,
				"type": "base",
				"updateRule": "(field.page_type.id = page.page_type) && ((@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page.site.id))",
				"viewRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = page.site.id)"
			},
			{
				"createRule": "@request.auth.serverRole != ''",
				"deleteRule": "@request.auth.serverRole != ''",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_2001081480",
						"hidden": false,
						"id": "relation1766001124",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "site",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"cascadeDelete": true,
						"collectionId": "_pb_users_auth_",
						"hidden": false,
						"id": "relation2375276105",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "user",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "select1466534506",
						"maxSelect": 1,
						"name": "role",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "select",
						"values": [
							"editor",
							"developer"
						]
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_2362756690",
				"indexes": [
					"CREATE UNIQUE INDEX ` + "`" + `idx_Z47WHtRrTe` + "`" + ` ON ` + "`" + `site_role_assignments` + "`" + ` (\n  ` + "`" + `site` + "`" + `,\n  ` + "`" + `user` + "`" + `\n)"
				],
				"listRule": "@request.auth.serverRole != '' || user.id = @request.auth.id",
				"name": "site_role_assignments",
				"system": false,
				"type": "base",
				"updateRule": "@request.auth.serverRole != ''",
				"viewRule": "@request.auth.serverRole != '' || user.id = @request.auth.id"
			},
			{
				"createRule": null,
				"deleteRule": null,
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"hidden": false,
						"id": "select2324736937",
						"maxSelect": 1,
						"name": "key",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "select",
						"values": [
							"instance_id"
						]
					},
					{
						"autogeneratePattern": "",
						"hidden": false,
						"id": "text494360628",
						"max": 0,
						"min": 0,
						"name": "value",
						"pattern": "",
						"presentable": false,
						"primaryKey": false,
						"required": false,
						"system": false,
						"type": "text"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_1721819618",
				"indexes": [
					"CREATE UNIQUE INDEX ` + "`" + `idx_nG5w6epnF4` + "`" + ` ON ` + "`" + `telemetry_values` + "`" + ` (` + "`" + `key` + "`" + `)"
				],
				"listRule": null,
				"name": "telemetry_values",
				"system": false,
				"type": "base",
				"updateRule": null,
				"viewRule": null
			},
			{
				"createRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = id)",
				"deleteRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = id)",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"cascadeDelete": true,
						"collectionId": "pbc_2001081480",
						"hidden": false,
						"id": "relation1766001124",
						"maxSelect": 1,
						"minSelect": 0,
						"name": "site",
						"presentable": false,
						"required": true,
						"system": false,
						"type": "relation"
					},
					{
						"hidden": false,
						"id": "file2359244304",
						"maxSelect": 1,
						"maxSize": 0,
						"mimeTypes": [],
						"name": "file",
						"presentable": false,
						"protected": false,
						"required": true,
						"system": false,
						"thumbs": [],
						"type": "file"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_1021288652",
				"indexes": [],
				"listRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)",
				"name": "site_uploads",
				"system": false,
				"type": "base",
				"updateRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = id)",
				"viewRule": "(@request.auth.serverRole != \"\") || (@collection.site_role_assignments.user.id = @request.auth.id && @collection.site_role_assignments.site.id = site.id)"
			},
			{
				"createRule": "@request.auth.serverRole != \"\"",
				"deleteRule": "@request.auth.serverRole != \"\"",
				"fields": [
					{
						"autogeneratePattern": "[a-z0-9]{15}",
						"hidden": false,
						"id": "text3208210256",
						"max": 15,
						"min": 15,
						"name": "id",
						"pattern": "^[a-z0-9]+$",
						"presentable": false,
						"primaryKey": true,
						"required": true,
						"system": true,
						"type": "text"
					},
					{
						"hidden": false,
						"id": "file2359244304",
						"maxSelect": 1,
						"maxSize": 0,
						"mimeTypes": [],
						"name": "file",
						"presentable": false,
						"protected": false,
						"required": true,
						"system": false,
						"thumbs": [],
						"type": "file"
					},
					{
						"hidden": false,
						"id": "autodate2990389176",
						"name": "created",
						"onCreate": true,
						"onUpdate": false,
						"presentable": false,
						"system": false,
						"type": "autodate"
					},
					{
						"hidden": false,
						"id": "autodate3332085495",
						"name": "updated",
						"onCreate": true,
						"onUpdate": true,
						"presentable": false,
						"system": false,
						"type": "autodate"
					}
				],
				"id": "pbc_3701780231",
				"indexes": [],
				"listRule": "@request.auth.serverRole != \"\"",
				"name": "library_uploads",
				"system": false,
				"type": "base",
				"updateRule": "@request.auth.serverRole != \"\"",
				"viewRule": "@request.auth.serverRole != \"\""
			}
		]`

			return app.ImportCollectionsByMarshaledJSON([]byte(jsonData), false)
		},
		func(app core.App) error {
			return nil
		},

		// Use old filename to ensure that the migration will not be redone on existing installations.
		"1742987171_created_site_groups.js",
	)
}
