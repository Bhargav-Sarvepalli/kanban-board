import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import type { Task, Profile } from '../../types'
import type { BlockStatus, DailyPlan, MorningSetupInput } from '../../types/daily'
import {
  fetchTodayDailyPlan,
  generateAndSaveDailyPlan,
  regenerateDailyBriefing,
  regenerateFullDailyPlan,
  updateDailyBlockStatus,
} from '../../services/daily/dailyPlanService'
import MorningSetupForm from './MorningSetupForm'
import DailyPlanTable from './DailyPlanTable'
import NexBriefingCard from './NexBriefingCard'
import TodayPrioritiesCard from './TodayPrioritiesCard'
import BlockersCard from './BlockersCard'

interface DailyPageProps {
  userId: string | null
  profile: Profile | null
  tasks: Task[]
  workspaceName: string
  projectName?: string
  isPersonal: boolean
  onOpenTask: (task: Task) => void
}

function LoadingState() {
  return (
    <div style={{ minHeight: 'calc(100vh - 110px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: '18px',
        background: 'rgba(255,255,255,0.04)',
        padding: '26px',
        color: '#d8d8e8',
        boxShadow: '0 24px 70px rgba(0,0,0,0.35)',
      }}>
        Nex is checking today's plan...
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', paddingTop: '80px' }}>
      <div style={{ border: '1px solid rgba(248,113,113,0.38)', background: 'rgba(248,113,113,0.08)', borderRadius: '18px', padding: '22px' }}>
        <p style={{ color: '#fecaca', fontSize: '18px', fontWeight: 850, margin: 0 }}>Nex could not load Daily Assistant.</p>
        <p style={{ color: '#f5b4b4', fontSize: '13px', lineHeight: 1.5, margin: '8px 0 16px' }}>{message}</p>
        <button type="button" onClick={onRetry} style={{ border: '1px solid rgba(248,113,113,0.5)', background: 'rgba(248,113,113,0.16)', color: '#fff', borderRadius: '12px', padding: '10px 14px', cursor: 'pointer', fontWeight: 800 }}>
          Try again
        </button>
      </div>
    </div>
  )
}

export default function DailyPage({ userId, profile, tasks, workspaceName, projectName, isPersonal, onOpenTask }: DailyPageProps) {
  const [plan, setPlan] = useState<DailyPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [regeneratingBriefing, setRegeneratingBriefing] = useState(false)
  const [regeneratingPlan, setRegeneratingPlan] = useState(false)
  const [updatingBlockId, setUpdatingBlockId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const taskById = useMemo(() => {
    const map = new Map<string, Task>()
    tasks.forEach(task => map.set(task.id, task))
    return map
  }, [tasks])

  const generationContext = useCallback((input: MorningSetupInput) => {
    if (!userId) throw new Error('You need to be signed in to create a Daily plan.')
    return { userId, profile, tasks, workspaceName, projectName, isPersonal, input }
  }, [isPersonal, profile, projectName, tasks, userId, workspaceName])

  const loadPlan = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError('')
    try {
      setPlan(await fetchTodayDailyPlan(userId))
    } catch (err) {
      console.error('[Daily] load failed', err)
      setError(err instanceof Error ? err.message : 'Daily plan storage is not available yet.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void loadPlan()
  }, [loadPlan])

  const handleGenerate = async (input: MorningSetupInput) => {
    setGenerating(true)
    setError('')
    try {
      const nextPlan = await generateAndSaveDailyPlan(generationContext(input))
      setPlan(nextPlan)
      toast.success('Daily plan ready')
    } catch (err) {
      console.error('[Daily] generate failed', err)
      setError(err instanceof Error ? err.message : 'Nex could not generate your plan. Try again with fewer details or check your connection.')
      toast.error('Could not generate Daily plan')
    } finally {
      setGenerating(false)
    }
  }

  const handleStatusChange = async (blockId: string, status: BlockStatus) => {
    if (!plan || updatingBlockId) return
    setUpdatingBlockId(blockId)
    try {
      const nextPlan = await updateDailyBlockStatus(plan, blockId, status)
      setPlan(nextPlan)
    } catch (err) {
      console.error('[Daily] status update failed', err)
      toast.error('Could not update the block')
    } finally {
      setUpdatingBlockId(null)
    }
  }

  const handleRegenerateBriefing = async () => {
    if (!plan) return
    setRegeneratingBriefing(true)
    try {
      const nextPlan = await regenerateDailyBriefing(plan, { profile, tasks, workspaceName, projectName, isPersonal })
      setPlan(nextPlan)
      toast.success('Briefing refreshed')
    } catch (err) {
      console.error('[Daily] briefing regenerate failed', err)
      toast.error('Could not regenerate briefing')
    } finally {
      setRegeneratingBriefing(false)
    }
  }

  const handleRegeneratePlan = async () => {
    if (!plan) return
    setRegeneratingPlan(true)
    try {
      const nextPlan = await regenerateFullDailyPlan(plan, { profile, tasks, workspaceName, projectName, isPersonal })
      setPlan(nextPlan)
      toast.success('Daily plan regenerated')
    } catch (err) {
      console.error('[Daily] full regenerate failed', err)
      toast.error('Could not regenerate plan')
    } finally {
      setRegeneratingPlan(false)
    }
  }

  const openLinkedTask = (taskId: string) => {
    const task = taskById.get(taskId)
    if (task) onOpenTask(task)
    else toast.error('That linked task is not visible in this board')
  }

  if (loading) return <LoadingState />
  if (error && !plan) return <ErrorState message={error} onRetry={() => void loadPlan()} />

  return (
    <div style={{
      minHeight: '100%',
      padding: '28px',
      background: 'radial-gradient(circle at 18% 10%, rgba(124,58,237,0.12), transparent 30%), radial-gradient(circle at 88% 8%, rgba(6,182,212,0.09), transparent 28%)',
    }}>
      <div style={{ maxWidth: '1480px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', marginBottom: '22px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ color: '#7dd3fc', fontSize: '11px', fontWeight: 900, letterSpacing: '0.16em', textTransform: 'uppercase', margin: 0 }}>Daily Assistant</p>
            <h1 style={{ color: '#fff', fontSize: '32px', lineHeight: 1.05, margin: '7px 0 6px', letterSpacing: '-0.04em' }}>Plan your day with Nex.</h1>
            <p style={{ color: '#c6c6d8', fontSize: '14px', margin: 0 }}>
              Turn tasks, energy, and commitments into a practical day plan.
            </p>
          </div>

          {plan && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setPlan(null)} style={{ border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.055)', color: '#f7f7fb', borderRadius: '12px', padding: '11px 14px', cursor: 'pointer', fontWeight: 800 }}>
                Edit morning setup
              </button>
              <button type="button" onClick={() => void handleRegeneratePlan()} disabled={regeneratingPlan} style={{ border: '1px solid rgba(167,139,250,0.48)', background: 'rgba(124,58,237,0.16)', color: '#fff', borderRadius: '12px', padding: '11px 14px', cursor: regeneratingPlan ? 'wait' : 'pointer', fontWeight: 800 }}>
                {regeneratingPlan ? 'Regenerating...' : 'Regenerate Full Plan'}
              </button>
            </div>
          )}
        </div>

        {!plan ? (
          <MorningSetupForm onGenerate={handleGenerate} loading={generating} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: '18px', alignItems: 'start' }}>
            <DailyPlanTable
              blocks={plan.scheduleBlocks}
              onStatusChange={handleStatusChange}
              onStartTask={openLinkedTask}
              updatingBlockId={updatingBlockId}
            />

            <aside style={{ display: 'grid', gap: '14px', position: 'sticky', top: '20px' }}>
              <NexBriefingCard
                summary={plan.summary}
                briefingText={plan.briefingText}
                onRegenerate={() => void handleRegenerateBriefing()}
                regenerating={regeneratingBriefing}
              />
              <TodayPrioritiesCard priorities={plan.priorities} onOpenTask={openLinkedTask} />
              <BlockersCard warnings={plan.warnings} />
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}

