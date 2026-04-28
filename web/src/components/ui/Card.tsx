import { type HTMLAttributes, type ReactNode } from 'react';

type Shadow = 'sm' | 'md' | 'lg' | 'none';

interface Props extends HTMLAttributes<HTMLDivElement> {
  shadow?: Shadow;
  children: ReactNode;
  as?: 'div' | 'section' | 'article';
}

const shadowStyle: Record<Shadow, string> = {
  none: '',
  sm:   '2px 2px 0 var(--ink)',
  md:   '3px 3px 0 var(--ink)',
  lg:   '4px 4px 0 var(--ink)',
};

export function Card({ shadow = 'md', children, as: Tag = 'div', className = '', style, ...props }: Props) {
  return (
    <Tag
      className={`bg-white rounded-2xl border-[1.5px] border-ink ${className}`}
      style={{ boxShadow: shadowStyle[shadow], ...style }}
      {...props}
    >
      {children}
    </Tag>
  );
}
