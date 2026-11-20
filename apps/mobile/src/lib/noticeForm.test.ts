import { MAX_ATTACHMENT_BYTES, attachmentError, noticeAttachmentPath, validateNotice } from './noticeForm';

jest.mock('./supabase', () => ({ supabase: {} }));

describe('validateNotice', () => {
  it('needs a title and a message', () => {
    expect(validateNotice('  ', 'Body')).toBe('Give the notice a title');
    expect(validateNotice('Water cut', '\n ')).toBe('Write the notice');
  });

  it('caps the title length', () => {
    expect(validateNotice('x'.repeat(121), 'Body')).toBe('Keep the title under 120 characters');
  });

  it('accepts a complete notice', () => {
    expect(validateNotice(' Water cut ', ' Tomorrow 10–12 ')).toBeNull();
  });
});

describe('noticeAttachmentPath', () => {
  it('puts the file in the society folder with the right extension', () => {
    expect(noticeAttachmentPath('soc-1', 'abc', 'image')).toBe('soc-1/abc.jpg');
    expect(noticeAttachmentPath('soc-1', 'abc', 'pdf')).toBe('soc-1/abc.pdf');
  });
});

describe('attachmentError', () => {
  it('rejects files over 10 MB', () => {
    expect(attachmentError(MAX_ATTACHMENT_BYTES + 1)).toBe('Attachments can be at most 10 MB');
  });

  it('accepts files up to 10 MB and unknown sizes', () => {
    expect(attachmentError(MAX_ATTACHMENT_BYTES)).toBeNull();
    expect(attachmentError(undefined)).toBeNull();
  });
});
