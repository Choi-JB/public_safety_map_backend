import { messaging } from '../config/firebase';
import prismaClient from "../config/prismaClient";

interface PushNotificationData {
  topic?: string;
  token?: string;
  type: string;
  title: string;
  data?: any;

}

/**
 * 알림 전송
 * @param pushNotificationData 알림 데이터
 * @returns 전송 결과
 */
export async function sendPushNotification(
  pushNotificationData: PushNotificationData,
) {
  console.log('push DATA: ', pushNotificationData);

  const isToken = pushNotificationData.token ? true : false;
  let message: any = {
    topic: isToken ? undefined : pushNotificationData.topic ?? 'all',
    token: isToken ? pushNotificationData.token : undefined,

    data: Object.fromEntries(
      Object.entries(pushNotificationData.data ?? {}).map(([k, v]) => [k, String(v)])
    ),
    notification: {
      title: pushNotificationData.title,
    },
    android: {
      priority: "high",
    },
    apns: { payload: { aps: { sound: "default" } } },
  };
  //앱 전송
  const response = await messaging.send(message);


  // 웹: DB 토큰 직접 전송
  const webDevices = await prismaClient.device_tokens.findMany({
    where: { is_active: "Y", device_type: "web" },
    select: { fcm_token: true },
  });
  const webTokens = webDevices.map((d) => d.fcm_token);
  if (webTokens.length > 0) {
    await messaging.sendEachForMulticast({
      tokens: webTokens,
      notification: { title: pushNotificationData.title },
      data: Object.fromEntries(
        Object.entries(pushNotificationData.data ?? {}).map(([k, v]) => [k, String(v)])
      ),
      webpush: { notification: { title: pushNotificationData.title } },
    });
  }

  return response;
}

// all 모든 유저에게 알림 전송 하게 all topic에 구독
export async function subscribeToAllTopic(fcmToken: string) {
  const result = await messaging.subscribeToTopic(fcmToken, "all");

  if (result.failureCount > 0) {
    console.error(
      "구독 실패 code:", result.errors[0].error.code,
      "message:", result.errors[0].error.message
    );
  } 

}