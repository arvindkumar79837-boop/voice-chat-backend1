const express = require('express');
const router = express.Router();
const EventController = require('../controllers/eventController');
const { authMiddleware: authenticateUser, requireRole } = require('../middlewares/auth.middleware');
const adminOnly = require('../middlewares/isAdmin');
const { validateObjectId, validatePagination, validateEmail, validateOTP, validatePhone, validateNumber, validateEnum, validateDate, validateBoolean, validateString, validateBodyObjectId, validateAllowedFields, validateRefreshToken, validatePassword, validateName, handleValidationErrors } = require('../middlewares/validation.middleware');

router.use(authenticateUser);

router.get('/active', validatePagination(), EventController.getActiveEvents);
router.get('/dashboard', validatePagination(), EventController.getUserEventsDashboard);
router.get('/history', validatePagination(), EventController.getUserEventHistory);
router.get('/stats', validatePagination(), EventController.getEventStats);
router.get('/:eventId', validatePagination(), EventController.getEventDetails);
router.post('/:eventId/join', validateObjectId('eventId'), EventController.joinEvent);
router.post('/:eventId/leave', validateObjectId('eventId'), EventController.leaveEvent);
router.post('/:eventId/claim', validateObjectId('eventId'), EventController.claimEventReward);
router.post('/:eventId/progress', validateObjectId('eventId'), EventController.updateProgress);
router.get('/:eventId/tournament/standings', validatePagination(), EventController.getTournamentStandings);
router.get('/:eventId/prize-pool', validatePagination(), EventController.getEventPrizePool);

router.use(adminOnly);

router.get('/admin/list', validatePagination(), EventController.getAllEventsAdmin);
router.post('/admin/create', EventController.createEvent);
router.put('/admin/:eventId', validateObjectId('eventId'), EventController.updateEvent);
router.delete('/admin/:eventId', EventController.deleteEvent);
router.patch('/admin/:eventId/prize-pool', validateObjectId('eventId'), EventController.updateEventPrizePool);
router.get('/admin/welcome-week/tasks', validatePagination(), EventController.getWelcomeWeekTasks);
router.post('/admin/welcome-week/tasks', EventController.createWelcomeWeekTask);
router.put('/admin/welcome-week/tasks/:taskId', validateObjectId('taskId'), EventController.updateWelcomeWeekTask);
router.get('/admin/festival/gifts', validatePagination(), EventController.getFestivalGifts);
router.post('/admin/festival/gifts', EventController.createFestivalGift);
router.get('/admin/anniversary/rewards', validatePagination(), EventController.getAnniversaryRewards);
router.post('/admin/anniversary/rewards', EventController.createAnniversaryReward);
router.post('/admin/:eventId/inject-gifts', validateObjectId('eventId'), EventController.injectFestivalGifts);

module.exports = router;