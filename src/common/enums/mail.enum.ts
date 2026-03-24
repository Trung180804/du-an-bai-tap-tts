export enum MailJob {
  SEND_WELCOME_EMAIL = 'sendWelcomeEmail',
  SEND_PAYMENT_FAILED_EMAIL = 'sendPaymentFailedEmail',
}

export enum MailSubject {
  WELCOME_VI = 'Chào mừng bạn tham gia hệ thống!',
  WELCOME_EN = 'Welcome to our system!',
  PAYMENT_FAILED_VI = 'Thông báo thanh toán thất bại',
  PAYMENT_FAILED_EN = 'Payment Failed Notification',
}

export enum MailTemplate {
  WELCOME = 'welcome',
  PAYMENT_FAILED = 'payment_failed',
}
