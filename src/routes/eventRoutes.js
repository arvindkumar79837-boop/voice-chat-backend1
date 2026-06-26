const express = require('express');
const router = express.Router();
const EventController = require('../controllers/eventController');
const { authenticateUser, adminOnly } = require('../middlewares/auth');

router.use(authenticateUser);

router.get('/active', EventController.getActiveEvents);
router.get('/dashboard', EventController.getUserEventsDashboard);
router.get('/history', EventController.getUserEventHistory);
router.get('/stats', EventController.getEventStats);
router.get('/:eventId', EventController.getEventDetails);
router.post('/:eventId/join', EventController.joinEvent);
router.post('/:eventId/leave', EventController.leaveEvent);
router.post('/:eventId/claim', EventController.claimEventReward);
router.post('/:eventId/progress', EventController.updateProgress);
router.get('/:eventId/tournament/standings', EventController.getTournamentStandings);
router.get('/:eventId/prize-pool', EventController.getEventPrizePool);

router.use(adminOnly);

router.get('/admin/list', EventController.getAllEventsAdmin);
router.post('/admin/create', EventController.createEvent);
router.put('/admin/:eventId', EventController.updateEvent);
router.delete('/admin/:eventId', EventController.deleteEvent);
router.patch('/admin/:eventId/prize-pool', EventController.updateEventPrizePool);
router.get('/admin/welcome-week/tasks', EventController.getWelcomeWeekTasks);
router.post('/admin/welcome-week/tasks', EventController.createWelcomeWeekTask);
router.put('/admin/welcome-week/tasks/:taskId', EventController.updateWelcomeWeekTask);
router.get('/admin/festival/gifts', EventController.getFestivalGifts);
router.post('/admin/festival/gifts', EventController.createFestivalGift);
router.get('/admin/anniversary/rewards', EventController.getAnniversaryRewards);
router.post('/admin/anniversary/rewards', EventController.createAnniversaryReward);
router.post('/admin/:eventId/inject-gifts', EventController.injectFestivalGifts);

module.exports = router;