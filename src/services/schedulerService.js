// ═══════════════════════════════════════════════════════════════════════════
// SERVICE: SchedulerService — Automated cycle scheduler for target audits
// Weekly, 15-Day, Monthly cycle creation and audit
// ═══════════════════════════════════════════════════════════════════════════

const TargetManager = require('../models/TargetManager');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const WalletTransaction = require('../models/WalletTransaction');

class SchedulerService {
  /**
   * Automatically audit all active targets and create new cycles
   * Called by cron job (can be set to run daily at midnight)
   */
  static async auditAllTargets() {
    console.log('🔄 [SchedulerService] Running target audit...');
    try {
      const activeTargets = await TargetManager.find({ isActive: true });
      let expiredCount = 0;
      let settledCount = 0;

      for (const target of activeTargets) {
        const now = new Date();
        const endDate = new Date(target.cycle.endDate);

        // If cycle has expired
        if (now > endDate) {
          // Auto-settle if target was met
          if (target.isTargetMet && !target.settlement.isSettled) {
            // Process any pending exchange requests
            for (let i = 0; i < target.diamondExchangeRequests.length; i++) {
              const req = target.diamondExchangeRequests[i];
              if (req.status === 'pending') {
                // Credit coins to streamer
                const streamer = await User.findById(target.streamerId);
                if (streamer) {
                  streamer.coins = (streamer.coins || 0) + req.coinAmount;
                  await streamer.save();

                  await WalletTransaction.create({
                    userId: streamer._id,
                    type: 'settlement',
                    amount: req.coinAmount,
                    description: `Auto-settlement: ${req.diamondAmount} diamonds → ${req.coinAmount} coins`,
                    status: 'completed',
                    metadata: { targetId: target._id.toString(), autoSettled: true },
                  });

                  req.status = 'approved';
                  req.processedAt = new Date();
                  req.processedBy = 'SYSTEM_SCHEDULER';
                }
              }
            }

            target.settlement.isSettled = true;
            target.settlement.settledAt = new Date();
            settledCount++;
          }

          target.isActive = false;
          expiredCount++;
          await target.save();
        }
      }

      console.log(`✅ [SchedulerService] Audit complete: ${expiredCount} expired, ${settledCount} auto-settled`);

      await AuditLog.create({
        action: 'SCHEDULER_AUDIT',
        performedBy: 'SYSTEM_SCHEDULER',
        details: `Target audit: ${expiredCount} expired, ${settledCount} auto-settled`,
      });
    } catch (error) {
      console.error('❌ [SchedulerService] Audit error:', error);
    }
  }

  /**
   * Auto-create new weekly/fifteen_day/monthly cycles for all active streamers
   * @param {string} cycleType - 'weekly' | 'fifteen_day' | 'monthly'
   * @param {number} defaultTargetDiamonds - Default target diamonds
   */
  static async autoCreateCyclesForAll(cycleType = 'weekly', defaultTargetDiamonds = 1000) {
    try {
      const streamers = await User.find({ role: 'streamer', isActive: true }).select('uid _id');
      const now = new Date();
      let startDate, endDate;

      switch (cycleType) {
        case 'weekly':
          startDate = new Date(now);
          endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'fifteen_day':
          startDate = new Date(now);
          endDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          startDate = new Date(now);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
          break;
        default:
          throw new Error(`Invalid cycle type: ${cycleType}`);
      }

      const targets = streamers.map((s) => ({
        streamerId: s._id,
        streamerUid: s.uid,
        cycle: { cycleType, startDate, endDate, targetDiamonds: defaultTargetDiamonds },
      }));

      if (targets.length > 0) {
        await TargetManager.insertMany(targets);
      }

      console.log(`✅ [SchedulerService] Created ${targets.length} ${cycleType} cycles`);
      return targets.length;
    } catch (error) {
      console.error('❌ [SchedulerService] Auto-create error:', error);
      return 0;
    }
  }

  /**
   * Start the scheduler with a given interval
   * @param {number} intervalMs - Interval in milliseconds (default: 24 hours)
   */
  static startScheduler(intervalMs = 24 * 60 * 60 * 1000) {
    console.log(`⏰ [SchedulerService] Started (interval: ${intervalMs / 1000 / 60 / 60}h)`);
    
    // Run immediately on start
    setTimeout(() => {
      SchedulerService.auditAllTargets();
    }, 5000); // 5 seconds after server start

    // Then run on interval
    setInterval(() => {
      SchedulerService.auditAllTargets();
    }, intervalMs);
  }
}

module.exports = SchedulerService;