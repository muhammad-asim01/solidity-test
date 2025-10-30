// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TodoCRUD {
    struct Todo {
        uint id;
        string title;
        bool completed;
    }

    mapping(uint => Todo) public todos;
    uint public nextId;

    // CREATE
    function createTodo(string calldata _title) public {
        todos[nextId] = Todo(nextId, _title, false);
        nextId++;
    }

    // READ
    function getTodo(uint _id) public view returns (Todo memory) {
        require(_id < nextId, "Todo does not exist");
        return todos[_id];
    }

    // UPDATE title
    function updateTitle(uint _id, string calldata _newTitle) public {
        require(_id < nextId, "Todo does not exist");
        todos[_id].title = _newTitle;
    }

    // UPDATE completed status
    function markCompleted(uint _id, bool _status) public {
        require(_id < nextId, "Todo does not exist");
        todos[_id].completed = _status;
    }

    // DELETE
    function deleteTodo(uint _id) public {
        require(_id < nextId, "Todo does not exist");
        delete todos[_id];
    }
}
