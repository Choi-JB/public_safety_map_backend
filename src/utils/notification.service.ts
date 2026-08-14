import { messaging } from '../config/firebase';

interface PushNotificationData {
  topic?: string;
  token?: string;
  type: string;
  title: string;
  data?: any;
  
}

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

  };

  const response = await messaging.send(message);

  console.log('FCM 전송 성공:', response);

  return response;
}

// all 모든 유저에게 알림 전송 하게 all topic에 구독
export async function subscribeToAllTopic(fcmToken: string) {
  await messaging.subscribeToTopic(fcmToken, "all");
}