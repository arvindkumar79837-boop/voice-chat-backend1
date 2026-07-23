const Gift = require('../models/Gift');
const User = require('../models/User');
const GiftEvent = require('../models/GiftEvent');
const Room = require('../models/Room');

module.exports = (io, socket) => {
    const authedUserId = socket.data.userId;

    // ─── Send Gift via Socket (realtime with wallet check) ─────
    const handleSendGift = async (data) => {
      try {
        const { roomId, senderName, receiverId, giftId, giftName, quantity, cost } = data;
        const senderId = authedUserId;

        if (!senderId || !giftId || !receiverId) {
          return socket.emit('gift_error', { message: 'Missing required fields.' });
        }

        const gift = await Gift.findById(giftId);
        if (!gift || !gift.isAvailable) {
          return socket.emit('gift_error', { message: 'Gift not available.' });
        }

        if (!gift.coinPrice || gift.coinPrice <= 0) {
          return socket.emit('gift_error', { message: 'Invalid gift price.' });
        }

        const actualCost = gift.coinPrice * (parseInt(quantity) || 1);

        // Atomic coin deduction — prevents double-spend race condition
        const updatedSender = await User.findOneAndUpdate(
          { _id: senderId, coins: { $gte: actualCost } },
          { $inc: { coins: -actualCost } },
          { new: true }
        );
        if (!updatedSender) {
          return socket.emit('gift_error', { message: 'Insufficient coins.' });
        }

        const cost = actualCost;

        // Update room gift points
        if (roomId) {
          const lootBoxIncrement = Math.floor(cost * 0.1);
          const rankIncrement = Math.floor(cost * 0.5);
          // Atomic room points update — prevents race condition on concurrent gifts
          await Room.findOneAndUpdate(
            { roomId },
            {
              $inc: {
                totalGiftPoints: cost,
                lootBoxPoints: lootBoxIncrement,
                rankPoints: rankIncrement,
              },
            }
          );
          // Check loot box level-up (read after atomic increment)
          const updatedRoom = await Room.findOne({ roomId });
          if (updatedRoom && updatedRoom.lootBoxPoints >= updatedRoom.lootBoxLevel * 100) {
            updatedRoom.lootBoxLevel += 1;
            updatedRoom.lootBoxPoints = 0;
            await updatedRoom.save();
          }
        }

        // Build full gift payload for animation rendering
        const payload = {
          eventId: `GFT_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          giftId: gift._id.toString(),
          giftName: gift.giftName || giftName,
          giftType: gift.giftType,
          category: gift.category,
          senderId,
          senderName: senderName || updatedSender.name || 'User',
          senderAvatar: updatedSender.avatar || '',
          receiverId,
          quantity: parseInt(quantity) || 1,
          comboMultiplier: 1,
          previewImageUrl: gift.previewImageUrl,
          animationUrl: gift.animationUrl,
          svgaUrl: gift.svgaUrl,
          animationJsonUrl: gift.animationJsonUrl,
          comboAnimationUrl: gift.comboEnabled ? gift.comboAnimationUrl : '',
          isLucky: gift.isLucky,
          isTreasure: gift.isTreasure,
          vehicleModelUrl: gift.vehicleModelUrl,
          castleModelUrl: gift.castleModelUrl,
          displayDurationSeconds: gift.displayDurationSeconds || 8,
          frameId: gift.frameId,
          frameImageUrl: gift.frameImageUrl,
          frameDurationDays: gift.frameDurationDays,
          avatarCustomizationId: gift.avatarCustomizationId,
          festivalId: gift.festivalId,
          festivalName: gift.festivalName,
          isLimitedEdition: gift.isLimitedEdition,
          coinCost: cost,
          timestamp: Date.now()
        };

        // Emit to all users in the room
        io.to(roomId).emit('live_gift_effect', payload);
        io.to(roomId).emit('gift:animation', {
          giftId: gift._id.toString(),
          giftType: gift.giftType,
          animationUrl: gift.animationUrl || gift.svgaUrl || gift.animationJsonUrl || '',
          senderId,
          senderName: senderName || updatedSender.name || 'User',
          receiverId,
          quantity: parseInt(quantity) || 1,
          coinCost: cost,
          timestamp: Date.now()
        });

        // SVGA animation trigger
        if (gift.giftType === 'SVGA' && gift.svgaUrl) {
          io.to(roomId).emit('svga_animation_play', {
            svgaUrl: gift.svgaUrl,
            duration: 5000,
            senderName: senderName || updatedSender.name || 'User'
          });
        }

        // 3D animation trigger
        if (gift.giftType === '3D' && gift.animationJsonUrl) {
          io.to(roomId).emit('3d_animation_play', {
            jsonUrl: gift.animationJsonUrl,
            duration: 8000,
            senderName: senderName || updatedSender.name || 'User'
          });
        }

        // Lucky gift effect
        if (gift.isLucky) {
          const multiplier = gift.luckyMultiplier && gift.luckyMultiplier.length > 0
            ? gift.luckyMultiplier[Math.floor(Math.random() * gift.luckyMultiplier.length)]
            : 1;
          const winAmount = cost * multiplier;
          if (multiplier > 1) {
            // Idempotency: prevent double-credit if socket handler fires twice
            const luckyKey = `LUCKY_${senderId}_${giftId}_${Date.now()}`;
            const existingLucky = await GiftEvent.findOne({ idempotencyKey: luckyKey });
            if (!existingLucky) {
              const luckySender = await User.findByIdAndUpdate(
                senderId,
                { $inc: { coins: winAmount } },
                { new: true }
              );
              await GiftEvent.create({
                eventId: `LKY-${Date.now().toString(36).toUpperCase()}`,
                idempotencyKey: luckyKey,
                giftId: gift._id,
                giftName: `Lucky Win: ${gift.giftName}`,
                senderId,
                receiverId: senderId,
                coinCostToSender: 0,
                diamondValueToReceiver: 0,
                quantity: 1,
                totalCoinsCost: 0,
                totalDiamondsEarned: 0,
                status: 'COMPLETED'
              });
              io.to(roomId).emit('lucky_jackpot', {
                senderId,
                senderName: senderName || updatedSender.name || 'User',
                multiplier,
                winAmount,
                totalWin: winAmount
              });
              if (luckySender) {
                socket.emit('gift_balance_updated', { balance: luckySender.coins });
              }
            }
          }
        }

        // Treasure chest spawn
        if (gift.isTreasure && gift.treasurePoolCoins > 0) {
          io.to(roomId).emit('treasure_chest_spawned', {
            giftId: gift._id.toString(),
            giftName: gift.giftName || giftName,
            poolCoins: gift.treasurePoolCoins,
            durationSeconds: gift.treasureDurationSeconds || 30,
            maxClaimers: gift.treasureMaxClaimers || 10,
            spawnerId: senderId,
            spawnerName: senderName || updatedSender.name || 'User'
          });
        }

        // Castle animation spawn
        if (gift.giftType === 'CASTLE' && gift.castleModelUrl) {
          io.to(roomId).emit('castle_spawned', {
            senderName: senderName || updatedSender.name || 'User',
            castleModelUrl: gift.castleModelUrl,
            displayDurationSeconds: gift.displayDurationSeconds || 10
          });
        }

        // Vehicle animation spawn
        if (gift.giftType === 'VEHICLE' && gift.vehicleModelUrl) {
          io.to(roomId).emit('vehicle_spawned', {
            senderName: senderName || updatedSender.name || 'User',
            vehicleModelUrl: gift.vehicleModelUrl,
            displayDurationSeconds: gift.displayDurationSeconds || 8
          });
        }

        // Combo counter for multi-quantity gifts
        if (parseInt(quantity) > 1) {
          io.to(roomId).emit('combo_counter_update', {
            senderId,
            senderName: senderName || updatedSender.name || 'User',
            comboMultiplier: parseInt(quantity),
            totalQuantity: parseInt(quantity),
            giftName: gift.giftName || giftName,
            totalCost: cost
          });
        }

        // Frame/Avatar unlock notification
        if (gift.frameId || gift.avatarCustomizationId) {
          io.to(roomId).emit('cosmetic_unlocked', {
            receiverId,
            frameId: gift.frameId,
            frameImageUrl: gift.frameImageUrl,
            frameDurationDays: gift.frameDurationDays,
            avatarCustomizationId: gift.avatarCustomizationId,
            senderName: senderName || updatedSender.name || 'User'
          });
        }

        // Festival gift special notification
        if (gift.festivalId || gift.isLimitedEdition) {
          io.to(roomId).emit('festival_gift_effect', {
            festivalName: gift.festivalName || 'Special Event',
            giftName: gift.giftName || giftName,
            senderName: senderName || updatedSender.name || 'User',
            isLimitedEdition: gift.isLimitedEdition,
            previewImageUrl: gift.previewImageUrl
          });
        }

        socket.emit('gift_balance_updated', { balance: updatedSender.coins });

      } catch (error) {
        console.error('Send Gift Socket Error:', error);
        socket.emit('gift_error', { message: 'Failed to send gift.' });
      }
    };
    socket.on('send_gift', handleSendGift);
    socket.on('gift:send', handleSendGift);

    // ─── Combo Gift Burst ──────────────────────────────────────
    socket.on('send_combo_gift', async (data) => {
      try {
        const { roomId, senderName, receiverId, giftId, giftName, comboMultiplier } = data;
        const senderId = authedUserId;
        const multiplier = parseInt(comboMultiplier) || 5;
        const totalQty = multiplier;

        if (![5, 10, 99, 999].includes(multiplier)) {
          return socket.emit('gift_error', { message: 'Combo must be 5, 10, 99, or 999.' });
        }

        const gift = await Gift.findById(giftId);
        if (!gift) return socket.emit('gift_error', { message: 'Gift not found.' });

        const totalCost = gift.coinPrice * totalQty;

        // Atomic coin deduction — prevents double-spend race condition
        const comboSender = await User.findOneAndUpdate(
          { _id: senderId, coins: { $gte: totalCost } },
          { $inc: { coins: -totalCost } },
          { new: true }
        );
        if (!comboSender) {
          return socket.emit('gift_error', { message: 'Insufficient coins for combo.' });
        }

        // Update room
        if (roomId) {
          const room = await Room.findOne({ roomId });
          if (room) {
            room.totalGiftPoints += totalCost;
            room.lootBoxPoints += Math.floor(totalCost * 0.1);
            room.rankPoints += Math.floor(totalCost * 0.5);
            if (room.lootBoxPoints >= room.lootBoxLevel * 100) {
              room.lootBoxLevel += 1;
              room.lootBoxPoints = 0;
            }
            await room.save();
          }
        }

        // Emit combo burst to room
        io.to(roomId).emit('combo_burst', {
          senderId,
          senderName: senderName || comboSender.name || 'User',
          giftId: gift._id.toString(),
          giftName: gift.giftName || giftName,
          comboMultiplier: multiplier,
          totalQuantity: totalQty,
          totalCost,
          comboAnimationUrl: gift.comboAnimationUrl || gift.animationUrl,
          svgaUrl: gift.svgaUrl,
          previewImageUrl: gift.previewImageUrl,
          timestamp: Date.now()
        });

        // Live combo counter that increments visually
        for (let i = 1; i <= multiplier; i++) {
          io.to(roomId).emit('combo_counter_update', {
            senderId,
            senderName: senderName || comboSender.name || 'User',
            comboMultiplier: i,
            totalQuantity: multiplier,
            giftName: gift.giftName || giftName,
            totalCost,
            isFinal: i === multiplier
          });
          // Small delay between combo steps for visual effect
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Final burst effect
        io.to(roomId).emit('combo_burst_final', {
          senderId,
          senderName: senderName || comboSender.name || 'User',
          multiplier,
          totalCost,
          giftName: gift.giftName || giftName
        });

        socket.emit('gift_balance_updated', { balance: comboSender.coins });

      } catch (error) {
        console.error('Combo Gift Socket Error:', error);
      }
    });

    // ─── Treasure Chest Tap (claim coins) ──────────────────────
    // Atomic claim — prevents race condition where multiple rapid claims
    // could award coins multiple times.
    socket.on('claim_treasure', async ({ roomId, userName, giftEventId }) => {
      const userId = authedUserId;
      try {
        const claimAmount = Math.floor(Math.random() * 490) + 10;

        // Atomic coin increment — no read-modify-write race
        const user = await User.findByIdAndUpdate(
          userId,
          { $inc: { coins: claimAmount } },
          { new: true }
        );
        if (!user) return;

        io.to(roomId).emit('treasure_claimed', {
          userId,
          userName: userName || user.name || 'User',
          claimAmount,
          balance: user.coins
        });
      } catch (error) {
        console.error('Claim Treasure Socket Error:', error);
      }
    });

    // ─── Gift Goal Progress Update ─────────────────────────────
    socket.on('update_gift_goal', async ({ roomId, currentCoins, targetCoins }) => {
      try {
        const progressPercent = targetCoins > 0 ? Math.min((currentCoins / targetCoins) * 100, 100) : 0;
        io.to(roomId).emit('gift_goal_updated', {
          currentCoins,
          targetCoins,
          progressPercent
        });
      } catch (error) {
        console.error('[update_gift_goal] error:', error.message);
        socket.emit('error', { message: 'Something went wrong. Please try again.' });
      }
    });

    // ─── Frame/Avatar Gift Effect ──────────────────────────────
    socket.on('send_frame_gift', ({ roomId, receiverId, frameId, frameImageUrl, senderName }) => {
      try {
        io.to(roomId).emit('frame_effect', {
          receiverId,
          frameId,
          frameImageUrl,
          senderName
        });
      } catch (error) {
        console.error('[send_frame_gift] error:', error.message);
        socket.emit('error', { message: 'Something went wrong. Please try again.' });
      }
    });
};