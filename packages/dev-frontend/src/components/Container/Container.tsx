import React, { useContext } from 'react'
import styled, { ThemeContext } from 'styled-components'

interface ContainerProps {
  children?: React.ReactNode,
  size?: 'sm' | 'md' | 'lg'
  backgroundColor?: string
  margin?: string
}

const Container: React.FC<ContainerProps> = ({ children, size = 'md', backgroundColor, margin }) => {
  const { siteWidth } = useContext<{ siteWidth: number }>(ThemeContext)
  let width: number
  switch (size) {
    case 'sm':
      width = siteWidth / 2
      break
    case 'md':
      width = siteWidth * 2 / 3
      break
    case 'lg':
    default:
      width = siteWidth
  }
  return (
    <StyledContainer width={width} backgroundColor={backgroundColor} margin={margin}>
      {children}
    </StyledContainer>
  )
}

interface StyledContainerProps {
  width: number
  backgroundColor?: string;
  margin?: string;
}

const StyledContainer = styled.div<StyledContainerProps>`
  box-sizing: border-box;
  margin: 0 auto;
  max-width: ${props => props.width}px;
  padding: 0 ${props => props.theme.spacing[4]}px;
  background: ${props => props.backgroundColor};
  margin: ${props => props.margin};
  width: 100%;
`

export default Container