import { Meta } from '@storybook/react'

import { Input as Component, InputTextArea } from './Input.styles'

export const textAreaInput: Meta<typeof Component> = {
  component: InputTextArea,
  title: 'Components/InputTextArea',
  argTypes: {
    typevalue: {
      control: {
        type: 'select',
        options: ['normal', 'ghost']
      }
    },
    color: {
      control: {
        type: 'select',
        options: ['primary', 'success', 'warning', 'error']
      }
    },
    size: {
      control: {
        type: 'select',
        options: ['small', 'middle', 'large']
      }
    }
  }
}
