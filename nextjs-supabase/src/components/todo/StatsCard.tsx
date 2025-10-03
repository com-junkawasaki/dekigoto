// Merkle DAG: stats_card -> metrics_display
// Component for displaying TODO statistics
interface StatsCardProps {
  title: string
  value: number
  color?: 'blue' | 'green' | 'yellow' | 'red'
}

export function StatsCard({ title, value, color = 'blue' }: StatsCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    red: 'bg-red-50 text-red-700'
  }

  return (
    <div className={`p-4 rounded-lg ${colorClasses[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-75">{title}</div>
    </div>
  )
}
