// Telegram-based activity logging - no external database needed

export interface Activity {
  id: string
  type: 'visitor' | 'login' | 'email_verification' | 'text_verification'
  timestamp: string
  date: string // YYYY-MM-DD format for easy filtering
  data: any
}

// Activity logging disabled - removed Telegram backup group configuration
async function sendActivityToTelegram(activity: Activity) {
  // Activity logging to Telegram has been disabled
  return
}

export async function logActivity(activity: Omit<Activity, 'id' | 'date'>) {
  try {
    const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    const logEntry: Activity = {
      id,
      date,
      ...activity
    }
    
    // Send to Telegram backup group as structured JSON
    await sendActivityToTelegram(logEntry)
    
    return logEntry
  } catch (error) {
    console.error('Failed to log activity:', error)
    // Don't throw - logging shouldn't break the app
    return null
  }
}

// Fetch messages from Telegram backup group for a specific date
// Note: Activity logging to Telegram has been disabled
export async function getActivitiesForDate(date: string): Promise<Activity[]> {
  // Activity logging to Telegram has been disabled
  return []
}

export async function getDailyStats(date: string) {
  const activities = await getActivitiesForDate(date)
  
  const stats = {
    date,
    totalActivities: activities.length,
    visitors: activities.filter(a => a.type === 'visitor').length,
    logins: activities.filter(a => a.type === 'login').length,
    emailVerifications: activities.filter(a => a.type === 'email_verification').length,
    textVerifications: activities.filter(a => a.type === 'text_verification').length,
    uniqueIPs: new Set(activities.filter(a => a.data.ip).map(a => a.data.ip)).size,
    activities: activities
  }
  
  return stats
}

