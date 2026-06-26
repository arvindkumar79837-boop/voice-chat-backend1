const DailyTask = require('../models/DailyTask');
const User = require('../models/User');
const UserEventProgress = require('../models/UserEventProgress');

// ─── ADMIN: CREATE DAILY TASK ─────────────────────────────────────────
exports.createDailyTask = async (req, res) => {
  try {
    const payload = req.body;
    if (!payload.task_name || !payload.task_type || !payload.target_value) {
      return res.status(400).json({ success: false, message: 'task_name, task_type, target_value required' });
    }
    const task = await DailyTask.create(payload);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    console.error('Create DailyTask Error:', error);
    res.status(500).json({ success: false, message: 'Failed to create task' });
  }
};

// ─── PUBLIC: GET ACTIVE DAILY TASKS ───────────────────────────────────
exports.getActiveTasks = async (req, res) => {
  try {
    const tasks = await DailyTask.find({ is_active: true });
    const userId = req.user.userId;

    // Enrich with user progress
    const enrichedTasks = [];
    for (const task of tasks) {
      const progress = await UserEventProgress.findOne({
        userId,
        taskId: task._id,
        createdAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lte: new Date(new Date().setHours(23, 59, 59, 999))
        }
      });

      enrichedTasks.push({
        _id: task._id,
        task_name: task.task_name,
        description: task.description,
        task_type: task.task_type,
        target_value: task.target_value,
        reward_coins: task.reward_coins,
        reward_diamonds: task.reward_diamonds,
        reward_xp: task.reward_xp,
        reward_frames: task.reward_frames,
        reward_badges: task.reward_badges,
        streak_bonus: task.streak_bonus,
        progress: progress ? progress.progress : 0,
        is_completed: progress ? progress.is_completed : false,
        is_claimed: progress ? progress.is_claimed : false
      });
    }

    res.status(200).json({ success: true, data: enrichedTasks });
  } catch (error) {
    console.error('Get DailyTasks Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
  }
};

// ─── PUBLIC: UPDATE TASK PROGRESS ─────────────────────────────────────
exports.updateTaskProgress = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { progressIncrement } = req.body;
    const userId = req.user.userId;

    const task = await DailyTask.findById(taskId);
    if (!task || !task.is_active) {
      return res.status(404).json({ success: false, message: 'Task not found or inactive' });
    }

    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));

    let userProgress = await UserEventProgress.findOne({
      userId,
      taskId,
      createdAt: { $gte: todayStart, $lte: todayEnd }
    });

    if (!userProgress) {
      userProgress = await UserEventProgress.create({
        userId,
        taskId,
        progress: 0,
        target_value: task.target_value,
        is_completed: false,
        is_claimed: false
      });
    }

    if (userProgress.is_completed) {
      return res.status(200).json({ success: true, data: userProgress, message: 'Task already completed' });
    }

    userProgress.progress = Math.min(userProgress.progress + (progressIncrement || 1), task.target_value);

    if (userProgress.progress >= task.target_value) {
      userProgress.is_completed = true;
      userProgress.completed_at = new Date();
    }

    await userProgress.save();

    res.status(200).json({ success: true, data: userProgress });
  } catch (error) {
    console.error('Update Task Progress Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update progress' });
  }
};

// ─── PUBLIC: CLAIM TASK REWARD ────────────────────────────────────────
exports.claimTaskReward = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const task = await DailyTask.findById(taskId);
    if (!task || !task.is_active) {
      return res.status(404).json({ success: false, message: 'Task not found or inactive' });
    }

    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));

    const userProgress = await UserEventProgress.findOne({
      userId,
      taskId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
      is_completed: true,
      is_claimed: false
    });

    if (!userProgress) {
      return res.status(400).json({ success: false, message: 'Task not completed or already claimed' });
    }

    // Distribute rewards
    user.coins = (user.coins || 0) + (task.reward_coins || 0);
    user.diamonds = (user.diamonds || 0) + (task.reward_diamonds || 0);
    user.xp = (user.xp || 0) + (task.reward_xp || 0);

    if (task.reward_frames && task.reward_frames.length > 0) {
      user.unlockedFrames = user.unlockedFrames || [];
      for (const frame of task.reward_frames) {
        if (!user.unlockedFrames.includes(frame)) {
          user.unlockedFrames.push(frame);
        }
      }
    }
    if (task.reward_badges && task.reward_badges.length > 0) {
      user.unlockedBadges = user.unlockedBadges || [];
      for (const badge of task.reward_badges) {
        if (!user.unlockedBadges.includes(badge)) {
          user.unlockedBadges.push(badge);
        }
      }
    }

    await user.save();

    userProgress.is_claimed = true;
    userProgress.claimed_at = new Date();
    await userProgress.save();

    res.status(200).json({
      success: true,
      message: 'Reward claimed',
      data: {
        coins: task.reward_coins,
        diamonds: task.reward_diamonds,
        xp: task.reward_xp,
        frames: task.reward_frames,
        badges: task.reward_badges
      }
    });
  } catch (error) {
    console.error('Claim Task Reward Error:', error);
    res.status(500).json({ success: false, message: 'Failed to claim reward' });
  }
};

// ─── ADMIN: GET ALL TASKS ─────────────────────────────────────────────
exports.adminGetAllTasks = async (req, res) => {
  try {
    const tasks = await DailyTask.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    console.error('Admin Get Tasks Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tasks' });
  }
};

// ─── ADMIN: UPDATE TASK ───────────────────────────────────────────────
exports.adminUpdateTask = async (req, res) => {
  try {
    const task = await DailyTask.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.status(200).json({ success: true, data: task });
  } catch (error) {
    console.error('Admin Update Task Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update task' });
  }
};

// ─── ADMIN: DELETE TASK ───────────────────────────────────────────────
exports.adminDeleteTask = async (req, res) => {
  try {
    const task = await DailyTask.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    res.status(200).json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error('Admin Delete Task Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete task' });
  }
};

// ─── SEED DEFAULT DAILY TASKS (Admin only) ────────────────────────────
exports.seedDefaultTasks = async (req, res) => {
  try {
    const defaultTasks = [
      {
        task_name: 'Daily Login',
        description: 'Log in to the app',
        task_type: 'LOGIN',
        target_value: 1,
        reward_coins: 20,
        reward_xp: 10
      },
      {
        task_name: 'Stay in Room',
        description: 'Stay in a room for 10 minutes',
        task_type: 'ROOM_STAY',
        target_value: 1,
        reward_coins: 30,
        reward_xp: 15
      },
      {
        task_name: 'Send Messages',
        description: 'Send 5 messages in any room',
        task_type: 'SEND_MESSAGES',
        target_value: 5,
        reward_coins: 15,
        reward_xp: 10
      },
      {
        task_name: 'Send Gifts',
        description: 'Send 3 gifts to other users',
        task_type: 'SEND_GIFTS',
        target_value: 3,
        reward_coins: 50,
        reward_diamonds: 2,
        reward_xp: 25
      },
      {
        task_name: 'PK Battle',
        description: 'Participate in 1 PK battle',
        task_type: 'PK_BATTLE',
        target_value: 1,
        reward_coins: 40,
        reward_xp: 20
      }
    ];

    for (const task of defaultTasks) {
      await DailyTask.findOneAndUpdate(
        { task_name: task.task_name },
        { $setOnInsert: task },
        { upsert: true }
      );
    }

    const allTasks = await DailyTask.find();
    res.status(200).json({ success: true, message: 'Default tasks seeded', data: allTasks });
  } catch (error) {
    console.error('Seed Tasks Error:', error);
    res.status(500).json({ success: false, message: 'Failed to seed tasks' });
  }
};