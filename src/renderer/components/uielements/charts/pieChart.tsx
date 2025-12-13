import { useMemo } from 'react'

import ReactECharts from 'echarts-for-react'

import { hiddenString } from '../../../helpers/stringHelper'
import { useTheme } from '../../../hooks/useTheme'
import { ChartColors } from './utils'

type ChartProps = {
  chartData: {
    name: string
    value: number
  }[]
  isPrivate?: boolean
  isLegendHidden?: boolean
  showLabelLine?: boolean
}

export const PieChart = ({
  isLegendHidden = false,
  showLabelLine = false,
  isPrivate = false,
  chartData
}: ChartProps) => {
  const { isLight: isLightTheme } = useTheme()

  // text-text2 dark:text-text2d
  const textColor = useMemo(() => (isLightTheme ? 'rgb(97, 107, 117)' : 'rgb(209, 213, 218)'), [isLightTheme])

  return (
    <ReactECharts
      className="w-full"
      option={{
        tooltip: {
          trigger: 'item',
          backgroundColor: isLightTheme ? '#fff' : '#101921',
          valueFormatter: (value: number) =>
            isPrivate
              ? hiddenString
              : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value),
          textStyle: {
            color: textColor
          }
        },
        legend: isLegendHidden
          ? { show: false }
          : {
              type: 'scroll',
              bottom: '0%',
              itemWidth: 20,
              itemHeight: 12,
              pageIconColor: textColor,
              pageTextStyle: {
                color: textColor
              },
              textStyle: {
                color: textColor,
                fontWeight: 'lighter'
              }
            },
        color: ChartColors,
        series: [
          {
            top: '0%',
            bottom: isLegendHidden ? '0%' : '20%',
            type: 'pie',
            radius: isLegendHidden ? ['40%', '70%'] : ['50%', '80%'],
            padAngle: 3,
            minAngle: 5,
            itemStyle: {
              borderRadius: 'full'
            },
            label: showLabelLine
              ? {
                  color: isLightTheme ? textColor : '#ffffff',
                  formatter: isPrivate ? `{b}: ${hiddenString}` : '{b}',
                  position: 'inside',
                  fontSize: 10,
                  fontWeight: isLightTheme ? 'normal' : 'bold',
                  textShadowColor: isLightTheme ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.95)',
                  textShadowBlur: isLightTheme ? 3 : 4
                }
              : { show: false },
            emphasis: showLabelLine ? {} : { label: { show: false } },
            labelLine: showLabelLine
              ? {
                  show: false
                }
              : { show: false },
            data: chartData
          }
        ]
      }}
    />
  )
}
