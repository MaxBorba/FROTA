import React, { useEffect } from 'react';
import { AppNotification } from '../types';
import { Bell, AlertTriangle, Clock, Wrench, Fuel, CheckCircle2, X } from 'lucide-react';

interface NotificationToastContainerProps {
  toasts: AppNotification[];
  onDismiss: (id: string) => void;
  onOpenCenter: () => void;
}

export const NotificationToastContainer: React.FC<NotificationToastContainerProps> = ({
  toasts,
  onDismiss,
  onOpenCenter,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      id="notification-toast-container"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => onDismiss(toast.id)}
          onClickToast={() => {
            onDismiss(toast.id);
            onOpenCenter();
          }}
        />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{
  toast: AppNotification;
  onDismiss: () => void;
  onClickToast: () => void;
}> = ({ toast, onDismiss, onClickToast }) => {
  // Auto-dismiss after 6.5s
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 6500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const getIcon = () => {
    switch (toast.type) {
      case 'RETURN_REMINDER':
        return <Clock className="w-5 h-5 text-amber-500" />;
      case 'MAINTENANCE_ALERT':
        return <Wrench className="w-5 h-5 text-red-500" />;
      case 'FUEL_ALERT':
        return <Fuel className="w-5 h-5 text-orange-500" />;
      case 'STATUS_CHANGE':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'BROADCAST':
        return <AlertTriangle className="w-5 h-5 text-indigo-500" />;
      default:
        return <Bell className="w-5 h-5 text-[#27a3df]" />;
    }
  };

  const getBgStyle = () => {
    if (toast.urgent) {
      return 'bg-slate-900 border-amber-400/80 text-white shadow-amber-500/20';
    }
    return 'bg-slate-900/95 border-slate-700 text-white shadow-slate-950/40';
  };

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border shadow-xl backdrop-blur-md transform transition-all duration-300 animate-slide-in hover:scale-[1.02] cursor-pointer ${getBgStyle()}`}
      onClick={onClickToast}
    >
      <div className="p-2 rounded-xl bg-slate-800/90 shrink-0 mt-0.5 border border-slate-700">
        {getIcon()}
      </div>

      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <h4 className="text-xs font-black tracking-tight text-white line-clamp-1">
            {toast.title}
          </h4>
          <span className="text-[10px] text-slate-400 font-mono shrink-0">
            {new Date(toast.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-xs text-slate-300 leading-snug line-clamp-2">
          {toast.message}
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition shrink-0"
        title="Fechar notificação"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
