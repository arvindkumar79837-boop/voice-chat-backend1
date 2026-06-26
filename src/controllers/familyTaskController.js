const FamilyTask = require('../models/FamilyTask');
const Family = require('../models/Family');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const familyTaskController = {};

familyTaskController.getFamilyTasks = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family' });
    }

    const tasks = await FamilyTask.find({ familyId: user.familyId, status: { $in: ['pending', 'in_progress'] } }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    console.error('Get Family Tasks Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch family tasks' });
  }
};

familyTaskController.claimTaskReward = async (req, res) => {
  try {
    const { taskId } = req.body;
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user || !user.familyId) {
      return res.status(404).json({ success: false, message: 'You are not in any family' });
    }

    const task = await FamilyTask.findOne({ _id: taskId, familyId: user.familyId });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (task.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Task is not completed yet' });
    }

    if (task.isClaimed) {
      return res.status(400).json({ success: false, message: 'Reward already claimed' });
    }

    const family = await Family.findOne({ familyId: user.familyId });
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    family.family_points = (family.family_points || 0) + task.rewardCoins;
    family.total_xp = (family.total_xp || 0) + task.rewardXP;
    await family.save();

    task.isClaimed = true;
    task.status = 'expired';
    await task.save();

    await Transaction.create({
      userId: user._id,
      familyId: user.familyId,
      type: 'family_task_reward',
      amount: task.rewardCoins,
      description: `Family task reward claimed: ${task.description}`,
      status: 'completed'
    });

    res.status(200).json({ success: true, message: 'Task reward claimed successfully', data: { earnedCoins: task.rewardCoins, earnedXP: task.rewardXP } });
  } catch (error) {
    console.error('Claim Task Reward Error:', error);
    res.status(500).json({ success: false, message: 'Failed to claim task reward' });
  }
};

familyTaskController.createFamilyTask = async (req, res) => {
  try {
    const { familyId, taskType, description, targetValue, rewardCoins, rewardXP, endDate } = req.body;

    const task = new FamilyTask({
      familyId,
      taskType,
      description,
      targetValue,
      rewardCoins,
      rewardXP,
      endDate
    });

    await task.save();
    res.status(201).json({ success: true, message: 'Family task created', data: task });
  } catch (error) {
    console.error('Create Family Task Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create family task' });
  }
};

familyTaskController.updateTaskProgress = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { progressValue } = req.body;

    const task = await FamilyTask.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    task.currentProgress = Math.min(task.targetValue, (task.currentProgress || 0) + progressValue);
    if (task.currentProgress >= task.targetValue) {
      task.status = 'completed';
    }

    await task.save();
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    console.error('Update Task Progress Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update task progress' });
  }
};

module.exports = familyTaskController;