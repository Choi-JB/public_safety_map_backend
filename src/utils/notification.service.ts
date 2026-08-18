import { messaging } from '../config/firebase';
import prismaClient from "../config/prismaClient";

interface PushNotificationData {
  topic?: string;
  token?: string;

  type: string;
  title: string;
  body?: string;
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
  //console.log('push DATA: ', pushNotificationData);

  const title = pushNotificationData.title;
  const body = pushNotificationData.body ?? title;
  const data = Object.fromEntries(
    Object.entries({
      type: pushNotificationData.type,
      title: String(title),
      body: String(body),
      ...(pushNotificationData.data ?? {}),
    }).map(([k, v]) => [k, String(v)])
  );

  const message = {
    // notification: {
    //   title: title,
    //   body: body,
    // },
    data: data,
    android: {
      priority: "high" as const, //우선순위 high or normal
      ttl: 300 * 1000, //300초 동안 알림 유지
      notification: {
        title: title,
        body: body,
        sound: "default"
      },
    },
    // webpush: {
    //   headers: { Urgency: "high" },
    //   notification: { title, body, requireInteraction: true },
    //   fcmOptions: { link: process.env.WEB_APP_URL ?? "http://localhost:3000" },
    // }
   
    // apns: { payload: { aps: { sound: "default" } } },  //ios 알림 설정
  };

  //앱 전송 (토큰이 있으면 그 토큰, 없으면 토픽)
  if (pushNotificationData.token) {
    await messaging.send({ token: pushNotificationData.token, ...message });
    //console.log('if token send');
  } else {
    await messaging.send({ topic: pushNotificationData.topic ?? "all", ...message });
    //console.log('if topic send');
  }


  // 웹: DB에 저장된 토큰 직접 전송
  // const webTokens = (
  //   await prismaClient.device_tokens.findMany({
  //     where: { is_active: "Y", device_type: "web" },
  //     select: { fcm_token: true },
  //   })
  // ).map((d) => d.fcm_token);
  // for (let i = 0; i < webTokens.length; i += 500) {
  //   await messaging.sendEachForMulticast({
  //     tokens: webTokens.slice(i, i + 500),
  //     ...message,
  //   });
  // }
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

//all topic에 구독 해제
export async function unsubscribeFromAllTopic(fcmTokens: string[]) {
  if (fcmTokens.length === 0) return;

  for (let i = 0; i < fcmTokens.length; i += 1000) {
    const result = await messaging.unsubscribeFromTopic(
      fcmTokens.slice(i, i + 1000),
      "all"
    );
    if (result.failureCount > 0) {
      console.error("토픽 해제 실패:", result.errors[0].error.message);
    }
  }
}