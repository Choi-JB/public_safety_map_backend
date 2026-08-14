import { Request, Response } from "express";
import prismaClient from "../config/prismaClient";
import { toKstWallClock } from "../utils/dateUtils";
import { sendPushNotification, subscribeToAllTopic } from "../utils/notification.service";

/** 알림 토큰 설정 */
export const setNotificationToken = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { fcmToken, device_type } = req.body;

    if (fcmToken === undefined || fcmToken === null || fcmToken === "") {
      return res.status(400).json({ success: false, message: "FCM token is required" });
    }

    const rawUserId = (req as any).user?.id;
    const userId = rawUserId != null ? BigInt(rawUserId) : null;

    await prismaClient.device_tokens.upsert({
      where: { fcm_token: fcmToken },
      update: {
        user_id: userId,
        device_type: device_type ?? undefined,
        is_active: 'Y',
        updated_at: toKstWallClock(),
      },
      create: {
        user_id: userId,
        fcm_token: fcmToken,
        device_type: device_type ?? null,
        created_at: toKstWallClock(),
      },
    });
    await subscribeToAllTopic(fcmToken);

    return res.status(200).json({ success: true, message: 'FCM token 설정 완료' });
  } catch (err) {
    console.error("[setAlarmToken]", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const sendNotification = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { fcmToken } = req.body;

    // const fcmToekn = await prismaClient.device_tokens.findMany({
    //   where:{
    //     is_active: 'Y',
    //   },
    //   select: {
    //     fcm_token: true,
    //     device_type: true,
    //   },
    // });

    if (!fcmToken) {
      return res.status(400).json({ message: 'fcmToken이 필요합니다.' });
    }

    const messageId = await sendPushNotification(
      {
        topic: 'all',
        token: fcmToken,
        title: 'FCM 테스트',
        data: {
          title: 'FCM 테스트',
          body: 'Public Safety Map 서버에서 보낸 테스트 알림입니다.',
          type: 'test',
        },
        type: 'test',
      }
    );

    return res.json({
      success: true,
      messageId,
    });
  } catch (err) {
    console.error('FCM 전송 실패:', err);

    return res.status(500).json({
      success: false,
      message: 'FCM 전송 실패',
    });
  }
};