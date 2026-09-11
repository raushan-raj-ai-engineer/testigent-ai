export type LocatorStrategy = 'label' | 'role' | 'text' | 'testId' | 'placeholder' | 'css';

export interface DeclarativeLocator {
  by: LocatorStrategy;
  value?: string;
  role?: 'button' | 'link' | 'textbox' | 'checkbox' | 'radio' | 'heading' | 'option';
  name?: string;
}

export type DeclarativeStep =
  | { action: 'goto'; url: string }
  | ({ action: 'click' } & DeclarativeLocator)
  | ({ action: 'fill'; text: string } & DeclarativeLocator)
  | ({ action: 'check' } & DeclarativeLocator)
  | ({ action: 'select'; option: string } & DeclarativeLocator)
  | ({ action: 'expectVisible' } & DeclarativeLocator)
  | ({ action: 'expectText'; text: string } & DeclarativeLocator);

export interface DeclarativeScenario {
  id: string;
  title: string;
  tags?: string[];
  steps: DeclarativeStep[];
}
