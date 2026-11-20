import { actorLabel, commentAuthor } from './attribution';

describe('actorLabel', () => {
  it('shows the person and the flat', () => {
    expect(actorLabel('Rahul', 'B1-A-101')).toBe('Rahul (B1-A-101)');
  });

  it('falls back to the flat when no name was given', () => {
    expect(actorLabel(null, 'B1-A-101')).toBe('B1-A-101');
    expect(actorLabel('  ', 'B1-A-101')).toBe('B1-A-101');
  });

  it('shows just the name when the flat is unknown', () => {
    expect(actorLabel('Rahul', null)).toBe('Rahul');
    expect(actorLabel(null, null)).toBe('Your flat');
  });
});

describe('commentAuthor', () => {
  const me = 'flat-user';

  it('labels comments from this flat with the person and the flat', () => {
    expect(commentAuthor({ author_id: me, author_name: 'Asha' }, me, 'B1-A-101')).toEqual({
      name: 'Asha (B1-A-101)',
      mine: true,
    });
  });

  it('labels comments from anyone else as the society office unless named', () => {
    expect(commentAuthor({ author_id: 'admin', author_name: null }, me, 'B1-A-101')).toEqual({
      name: 'Society office',
      mine: false,
    });
    expect(commentAuthor({ author_id: 'admin', author_name: 'Secretary' }, me, 'B1-A-101')).toEqual({
      name: 'Secretary',
      mine: false,
    });
  });
});
