import { Container } from '@/components/layout/Container';
import { Stack } from '@/components/layout/Stack';
import { Skeleton } from '@/components/ui/Skeleton';
import styles from './PortalRouteLoading.module.scss';

export type PortalRouteLoadingVariant =
  'dashboard' | 'quotes' | 'schedule' | 'customers' | 'default' | 'board' | 'table';

function resolveVariant(
  variant: PortalRouteLoadingVariant,
): 'dashboard' | 'quotes' | 'schedule' | 'customers' {
  if (variant === 'board') return 'quotes';
  if (variant === 'table') return 'schedule';
  if (variant === 'default') return 'dashboard';
  return variant;
}

function PageHeaderSkeleton({ withAction = true }: { withAction?: boolean }) {
  return (
    <div className={styles.pageHeader}>
      <div className={styles.pageHeaderCopy}>
        <Skeleton width="38%" height={32} radius="md" />
        <Skeleton width="62%" height={16} />
      </div>
      {withAction ? (
        <div className={styles.pageHeaderAction}>
          <Skeleton width={132} height={40} radius="md" />
        </div>
      ) : null}
    </div>
  );
}

function DashboardLoading() {
  return (
    <Container
      size="lg"
      className={styles.wrap}
      aria-busy="true"
      aria-label="Loading"
      data-route-loading
    >
      <PageHeaderSkeleton withAction={false} />
      <div className={styles.statGrid}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.statCard}>
            <Skeleton width={40} height={40} radius="md" />
            <Skeleton width="55%" height={18} />
            <Skeleton width="35%" height={36} />
            <Skeleton width="70%" height={28} radius="pill" />
            <Skeleton width="45%" height={14} />
          </div>
        ))}
      </div>
      <div className={styles.dashboardGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <Skeleton width="42%" height={22} />
            <Skeleton width="68%" height={14} />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.queueRow}>
              <div className={styles.queueRowCopy}>
                <Skeleton width="72%" height={16} />
                <Skeleton width="48%" height={12} />
              </div>
              <Skeleton width={72} height={32} radius="md" />
            </div>
          ))}
        </div>
        <div className={styles.panel}>
          <Skeleton width="58%" height={20} />
          <Stack gap={3}>
            <Skeleton width="100%" height={14} />
            <Skeleton width="88%" height={14} />
            <Skeleton width="100%" height={36} radius="md" />
          </Stack>
        </div>
      </div>
    </Container>
  );
}

function QuotesLoading() {
  return (
    <Container
      size="full"
      className={styles.wrap}
      aria-busy="true"
      aria-label="Loading"
      data-route-loading
    >
      <PageHeaderSkeleton />
      <div className={styles.viewTabs}>
        <Skeleton width={160} height={18} />
        <Skeleton width={180} height={18} />
      </div>
      <div className={styles.boardRow}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.boardColumn}>
            <div className={styles.boardColumnHeader}>
              <Skeleton width="58%" height={18} />
              <Skeleton width={24} height={24} radius="pill" />
            </div>
            <div className={styles.boardColumnBody}>
              {Array.from({ length: i % 2 === 0 ? 2 : 1 }).map((_, j) => (
                <div key={j} className={styles.boardCard}>
                  <Skeleton width="88%" height={16} />
                  <Skeleton width="64%" height={14} />
                  <Skeleton width="42%" height={20} />
                  <div className={styles.boardCardFooter}>
                    <Skeleton width="38%" height={12} />
                    <Skeleton width={72} height={22} radius="pill" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}

function ScheduleLoading() {
  const visitOffsets = ['8%', '28%', '52%'];

  return (
    <Container
      size="full"
      className={styles.wrap}
      aria-busy="true"
      aria-label="Loading"
      data-route-loading
    >
      <PageHeaderSkeleton />
      <div className={styles.scheduleShell}>
        <div className={styles.scheduleControlBar}>
          <div className={styles.scheduleControlLeft}>
            <Skeleton width={36} height={36} radius="md" />
            <Skeleton width={36} height={36} radius="md" />
          </div>
          <div className={styles.scheduleControlCenter}>
            <Skeleton width={180} height={18} />
            <Skeleton width={48} height={14} />
          </div>
          <div className={styles.scheduleControlRight}>
            <Skeleton width={52} height={36} radius="md" />
            <Skeleton width={52} height={36} radius="md" />
            <Skeleton width={52} height={36} radius="md" />
          </div>
        </div>
        <div className={styles.dayBoard}>
          <div className={styles.hourRail}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} width="70%" height={12} />
            ))}
          </div>
          <div className={styles.timelineTrack}>
            {visitOffsets.map((top, i) => (
              <div key={i} className={styles.visitCard} style={{ top }}>
                <div className={styles.visitCardLines}>
                  <Skeleton width="78%" height={14} />
                  <Skeleton width="52%" height={12} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Container>
  );
}

function CustomersLoading() {
  return (
    <Container
      size="lg"
      className={styles.wrap}
      aria-busy="true"
      aria-label="Loading"
      data-route-loading
    >
      <PageHeaderSkeleton />
      <div className={styles.directoryPanel}>
        <div className={styles.searchForm}>
          <Skeleton width="100%" height={44} radius="md" />
          <div className={styles.directoryTabs}>
            <Skeleton width={88} height={36} radius="pill" />
            <Skeleton width={96} height={36} radius="pill" />
            <Skeleton width={104} height={36} radius="pill" />
          </div>
        </div>
        <div className={styles.tableHead}>
          <Skeleton width="40%" height={12} />
          <Skeleton width="55%" height={12} />
          <Skeleton width="60%" height={12} />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={styles.tableRow}>
            <div className={styles.tableRowCustomer}>
              <Skeleton width="72%" height={16} />
              <Skeleton width="48%" height={12} />
            </div>
            <Skeleton width="80%" height={14} />
            <Skeleton width={88} height={24} radius="pill" />
          </div>
        ))}
      </div>
    </Container>
  );
}

export function PortalRouteLoading({
  variant = 'default',
}: {
  variant?: PortalRouteLoadingVariant;
}) {
  switch (resolveVariant(variant)) {
    case 'quotes':
      return <QuotesLoading />;
    case 'schedule':
      return <ScheduleLoading />;
    case 'customers':
      return <CustomersLoading />;
    default:
      return <DashboardLoading />;
  }
}
