interface StatsCardProps {
  title: string
  value: number
  color?: string
  icon?: React.ReactNode
}

export default function StatsCard({ title, value, color = 'blue', icon }: StatsCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  }

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color as keyof typeof colorClasses] || colorClasses.blue}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        {icon && <div className="text-2xl">{icon}</div>}
      </div>
    </div>
  )
}
