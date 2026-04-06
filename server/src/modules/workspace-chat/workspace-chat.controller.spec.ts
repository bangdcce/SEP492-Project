import { WorkspaceChatController } from './workspace-chat.controller';

describe('WorkspaceChatController', () => {
  let controller: WorkspaceChatController;
  let workspaceChatService: Record<string, jest.Mock>;

  beforeEach(() => {
    workspaceChatService = {
      getMessages: jest.fn(),
      togglePin: jest.fn(),
      editMessage: jest.fn(),
      softDeleteMessage: jest.fn(),
    };

    controller = new WorkspaceChatController(workspaceChatService as any);
  });

  describe('getMessages', () => {
    it('UC37-CHAT-GET-UTCID01 loads messages with default pagination when the query string omits limit and offset', async () => {
      const messages = [
        {
          id: 'message-1',
          content: 'Hello team',
        },
      ];
      workspaceChatService.getMessages.mockResolvedValue(messages);

      await expect(
        controller.getMessages('project-1', { id: 'user-1' } as any, undefined, undefined, undefined),
      ).resolves.toEqual({
        success: true,
        data: messages,
        pagination: {
          limit: 30,
          offset: 0,
          count: 1,
        },
      });
      expect(workspaceChatService.getMessages).toHaveBeenCalledWith(
        'project-1',
        30,
        0,
        undefined,
        'user-1',
      );
    });

    it('UC37-CHAT-GET-UTCID02 clamps pagination metadata for oversized or negative query values', async () => {
      const messages = [{ id: 'message-1' }, { id: 'message-2' }];
      workspaceChatService.getMessages.mockResolvedValue(messages);

      await expect(
        controller.getMessages('project-1', { id: 'user-1' } as any, '999', '-5', 'risk'),
      ).resolves.toEqual({
        success: true,
        data: messages,
        pagination: {
          limit: 100,
          offset: 0,
          count: 2,
        },
      });
      expect(workspaceChatService.getMessages).toHaveBeenCalledWith(
        'project-1',
        999,
        -5,
        'risk',
        'user-1',
      );
    });

    it('UC37-CHAT-GET-UTCID03 falls back to default pagination metadata when query values are non-numeric strings', async () => {
      const messages = [{ id: 'message-3', content: 'Filtered hit' }];
      workspaceChatService.getMessages.mockResolvedValue(messages);

      await expect(
        controller.getMessages('project-1', { id: 'user-1' } as any, 'abc', 'xyz', 'deploy'),
      ).resolves.toEqual({
        success: true,
        data: messages,
        pagination: {
          limit: 30,
          offset: 0,
          count: 1,
        },
      });
      expect(workspaceChatService.getMessages).toHaveBeenCalledWith(
        'project-1',
        Number.NaN,
        Number.NaN,
        'deploy',
        'user-1',
      );
    });
  });

  describe('updatePinnedState', () => {
    it('UC37-CHAT-PIN-UTCID01 forwards the pin toggle payload to WorkspaceChatService.togglePin', async () => {
      const message = { id: 'message-1', isPinned: true };
      workspaceChatService.togglePin.mockResolvedValue(message);

      await expect(
        controller.updatePinnedState(
          'project-1',
          'message-1',
          { id: 'user-1' } as any,
          { isPinned: true } as any,
        ),
      ).resolves.toEqual({
        success: true,
        data: message,
      });
      expect(workspaceChatService.togglePin).toHaveBeenCalledWith(
        'project-1',
        'message-1',
        'user-1',
        true,
      );
    });

    it('UC37-CHAT-PIN-UTCID02 forwards an omitted pin flag as undefined so the service can toggle the current state', async () => {
      const message = { id: 'message-1', isPinned: false };
      workspaceChatService.togglePin.mockResolvedValue(message);

      await expect(
        controller.updatePinnedState(
          'project-1',
          'message-1',
          { id: 'user-1' } as any,
          {} as any,
        ),
      ).resolves.toEqual({
        success: true,
        data: message,
      });
      expect(workspaceChatService.togglePin).toHaveBeenCalledWith(
        'project-1',
        'message-1',
        'user-1',
        undefined,
      );
    });

    it('UC37-CHAT-PIN-UTCID03 forwards an explicit false value so the service can unpin the message deterministically', async () => {
      const message = { id: 'message-1', isPinned: false };
      workspaceChatService.togglePin.mockResolvedValue(message);

      await expect(
        controller.updatePinnedState(
          'project-1',
          'message-1',
          { id: 'user-1' } as any,
          { isPinned: false } as any,
        ),
      ).resolves.toEqual({
        success: true,
        data: message,
      });
      expect(workspaceChatService.togglePin).toHaveBeenCalledWith(
        'project-1',
        'message-1',
        'user-1',
        false,
      );
    });
  });

  describe('editMessage', () => {
    it('UC37-CHAT-EDIT-UTCID01 forwards the edit payload to WorkspaceChatService.editMessage', async () => {
      const message = { id: 'message-1', content: 'Updated content' };
      workspaceChatService.editMessage.mockResolvedValue(message);

      await expect(
        controller.editMessage(
          'project-1',
          'message-1',
          { id: 'user-1' } as any,
          { content: 'Updated content' } as any,
        ),
      ).resolves.toEqual({
        success: true,
        data: message,
      });
      expect(workspaceChatService.editMessage).toHaveBeenCalledWith(
        'project-1',
        'message-1',
        'user-1',
        'Updated content',
      );
    });

    it('UC37-CHAT-EDIT-UTCID02 propagates edit failures from the service layer', async () => {
      workspaceChatService.editMessage.mockRejectedValue(new Error('Message not found'));

      await expect(
        controller.editMessage(
          'project-1',
          'message-1',
          { id: 'user-1' } as any,
          { content: 'Updated content' } as any,
        ),
      ).rejects.toThrow('Message not found');
      expect(workspaceChatService.editMessage).toHaveBeenCalledWith(
        'project-1',
        'message-1',
        'user-1',
        'Updated content',
      );
    });

    it('UC37-CHAT-EDIT-UTCID03 forwards empty-string content because the DTO only enforces string type', async () => {
      const message = { id: 'message-1', content: '' };
      workspaceChatService.editMessage.mockResolvedValue(message);

      await expect(
        controller.editMessage(
          'project-1',
          'message-1',
          { id: 'user-1' } as any,
          { content: '' } as any,
        ),
      ).resolves.toEqual({
        success: true,
        data: message,
      });
      expect(workspaceChatService.editMessage).toHaveBeenCalledWith(
        'project-1',
        'message-1',
        'user-1',
        '',
      );
    });
  });

  describe('deleteMessage', () => {
    it('UC37-CHAT-DELETE-UTCID01 forwards delete requests to WorkspaceChatService.softDeleteMessage', async () => {
      const message = { id: 'message-1', isDeleted: true };
      workspaceChatService.softDeleteMessage.mockResolvedValue(message);

      await expect(
        controller.deleteMessage('project-1', 'message-1', { id: 'user-1' } as any),
      ).resolves.toEqual({
        success: true,
        data: message,
      });
      expect(workspaceChatService.softDeleteMessage).toHaveBeenCalledWith(
        'project-1',
        'message-1',
        'user-1',
      );
    });

    it('UC37-CHAT-DELETE-UTCID02 propagates delete failures from the service layer', async () => {
      workspaceChatService.softDeleteMessage.mockRejectedValue(
        new Error('You can only delete your own messages'),
      );

      await expect(
        controller.deleteMessage('project-1', 'message-1', { id: 'user-1' } as any),
      ).rejects.toThrow('You can only delete your own messages');
      expect(workspaceChatService.softDeleteMessage).toHaveBeenCalledWith(
        'project-1',
        'message-1',
        'user-1',
      );
    });

    it('UC37-CHAT-DELETE-UTCID03 propagates not-found delete failures from the service layer', async () => {
      workspaceChatService.softDeleteMessage.mockRejectedValue(new Error('Message not found'));

      await expect(
        controller.deleteMessage('project-1', 'message-missing', { id: 'user-1' } as any),
      ).rejects.toThrow('Message not found');
      expect(workspaceChatService.softDeleteMessage).toHaveBeenCalledWith(
        'project-1',
        'message-missing',
        'user-1',
      );
    });
  });
});
