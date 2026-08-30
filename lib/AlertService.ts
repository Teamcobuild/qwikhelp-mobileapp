export type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AlertOptions = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
};

class AlertService {
  private alertCallback: ((options: AlertOptions) => void) | null = null;

  setAlertCallback(callback: (options: AlertOptions) => void) {
    this.alertCallback = callback;
  }

  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (this.alertCallback) {
      this.alertCallback({ title, message, buttons });
    } else {
      console.warn("AlertService not initialized. Alert:", title, message);
    }
  }
}

export const alertService = new AlertService();
