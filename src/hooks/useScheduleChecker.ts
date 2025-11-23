import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';

interface Pipeline {
  id: string;
  name: string;
  schedule_config?: {
    type: string;
    hours?: number;
    value?: string;
    times?: string[];
    lastRun?: string | null;
    nextRun?: string | null;
  };
  status: string;
}

export function useScheduleChecker() {
  const { showToast } = useToast();
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const notifiedPipelinesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkSchedules = async () => {
      try {
        const { data: pipelines, error } = await supabase
          .from('pipelines')
          .select('id, name, schedule_config, status')
          .eq('status', 'ready')
          .not('schedule_config', 'is', null);

        if (error) throw error;
        if (!pipelines) return;

        const now = new Date();

        for (const pipeline of pipelines as Pipeline[]) {
          if (!pipeline.schedule_config) continue;

          const config = pipeline.schedule_config;
          let shouldRun = false;
          let intervalMinutes = 0;

          if (config.type === 'preset') {
            const value = config.value || '6h';
            if (value === '30m') intervalMinutes = 30;
            else if (value === '1h') intervalMinutes = 60;
            else if (value === '2h') intervalMinutes = 120;
            else if (value === '3h') intervalMinutes = 180;
            else if (value === '6h') intervalMinutes = 360;
            else if (value === '8h') intervalMinutes = 480;
            else if (value === '12h') intervalMinutes = 720;
            else if (value === '24h') intervalMinutes = 1440;
          } else if (config.type === 'interval') {
            const hours = config.hours || 6;
            intervalMinutes = hours * 60;
          } else if (config.type === 'daily') {
            const times = config.times || ['00:00'];
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            for (const time of times) {
              const [targetHour, targetMinute] = time.split(':').map(Number);
              const nowMinute = now.getHours() * 60 + now.getMinutes();
              const targetMinuteOfDay = targetHour * 60 + targetMinute;

              if (Math.abs(nowMinute - targetMinuteOfDay) < 1) {
                shouldRun = true;
                break;
              }
            }
          }

          if (config.type === 'preset' || config.type === 'interval') {
            if (config.lastRun) {
              const lastRunDate = new Date(config.lastRun);
              const minutesSinceLastRun = (now.getTime() - lastRunDate.getTime()) / (1000 * 60);

              if (minutesSinceLastRun >= intervalMinutes) {
                shouldRun = true;
              }
            } else {
              shouldRun = true;
            }
          }

          if (shouldRun && !notifiedPipelinesRef.current.has(pipeline.id)) {
            showToast(
              'info',
              `Pipeline "${pipeline.name}" is scheduled to run`,
              'Starting data ingestion...'
            );

            notifiedPipelinesRef.current.add(pipeline.id);

            await supabase
              .from('pipelines')
              .update({
                schedule_config: {
                  ...config,
                  lastRun: now.toISOString(),
                  nextRun: new Date(now.getTime() + intervalMinutes * 60 * 1000).toISOString()
                }
              })
              .eq('id', pipeline.id);

            setTimeout(() => {
              notifiedPipelinesRef.current.delete(pipeline.id);
            }, 60000);
          }
        }
      } catch (error) {
        console.error('Schedule check error:', error);
      }
    };

    checkSchedules();
    checkIntervalRef.current = setInterval(checkSchedules, 30000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [showToast]);
}
