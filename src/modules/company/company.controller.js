const companyService = require('./company.service');
const { generateToken } = require('../../utils/jwt');

const createCompany = async (req, res) => {
    try {
        const company = await companyService.createCompany({
            ...req.body,
            created_by: req.user.userId
        });
        return res.status(201).json({
            success: true,
            message: 'Company created successfully',
            data: company
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create company'
        });
    }
};

const inviteAdminToCompany = async (req, res) => {
    try {
        const { companyId, adminEmail, adminName, role } = req.body;
        const invitation = await companyService.inviteAdminToCompany(
            companyId,
            adminEmail,
            adminName,
            req.user.userId,
            role
        );
        return res.status(201).json({
            success: true,
            message: 'Invitation created successfully',
            data: invitation
        });
    } catch (error) {
        if (error.code === 'INVALID_INVITATION') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        if (error.code === 'EMAIL_ALREADY_REGISTERED') {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }
        console.error(error);
        return res.status(500).json({
            success: false,
            message: 'Failed to invite admin to company'
        });
    }
};

const acceptCompanyInvitation = async (req, res) => {
    try {
        const { token, password } = req.body;
        const user = await companyService.acceptCompanyInvitation(token, password);
        const authToken = generateToken(user);

        return res.status(200).json({
            success: true,
            message: 'Invitation accepted; you are now logged in',
            data: { user },
            token: authToken
        });
    } catch (error) {
        if (['INVALID_INVITATION', 'INVITATION_EXPIRED', 'INVALID_PASSWORD'].includes(error.code)) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        if (error.code === 'EMAIL_ALREADY_REGISTERED') {
            return res.status(409).json({
                success: false,
                message: error.message
            });
        }
        console.error(error);
        return res.status(500).json({
            success: false,
            message: 'Failed to accept invitation'
        });
    }
};

module.exports = {
    createCompany,
    inviteAdminToCompany,
    acceptCompanyInvitation
};