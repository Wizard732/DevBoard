import 'dotenv/config'; // Загружаем переменные из .env
import { Telegraf } from 'telegraf';
import { getTasks, createTask, markTaskDone, deleteTask } from "./api_client.js";

// Проверка токена
if (!process.env.BOT_TOKEN) {
  console.error("ОШИБКА: переменная BOT_TOKEN не задана!");
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.command("start", (ctx) => {
  ctx.reply("Привет! Я твой менеджер задач.\n\nКоманды:\n/add Название задачи\n/list - список\n/done ID - пометить как готово\n/delete ID - удалить");
});

bot.command("add", async (ctx) => {
  const input = ctx.message.text.split(" ");
  input.shift();
  const title = input.join(" ").trim();

  if (!title) {
    ctx.reply("Ты не ввел название задачи:\n/add Купить хлеб");
    return;
  }

  try {
    const task = await createTask(title);
    ctx.reply(`✅ Задача создана!\nID: ${task.id}\nНазвание: ${task.title}`);
  } catch (error) {
    console.error("DEBUG ERROR:", error);
    ctx.reply("Не удалось создать задачу. API недоступен.");
  }
});

bot.command("list", async (ctx) => {
  try {
    const tasks = await getTasks()

    if (tasks.length === 0) {
      ctx.reply("Задач нет. Создайте первую через /add")
      return
    }

    let message = "Список задач:\n\n"

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]
      message += `${i + 1}. ${task.title}\n`
      message += `   Статус: ${task.status}\n`
      message += `   ID: ${task.id}\n\n`
    }

    ctx.reply(message)
  } catch (error) {
    console.log(error)
    ctx.reply("Не удалось загрузить задачи. API недоступен")
  }
})

bot.command("done", async (ctx) => {
  const taskId = ctx.message.text.replace("/done", "").trim()

  if (taskId === "") {
    ctx.reply("Укажите ID задачи. Например: /done 123e4567-e89b-12d3")
    return
  }

  try {
    const task = await markTaskDone(taskId)
    ctx.reply(`Готово! Задача "${task.title}" выполнена`)
  } catch (error) {
    console.log(error)
    ctx.reply("Не удалось обновить задачу. Проверьте ID или API недоступен")
  }
})

bot.command("delete", async (ctx) => {
  const taskId = ctx.message.text.replace("/delete", "").trim()

  if (taskId === "") {
    ctx.reply("Укажите ID задачи. Например: /delete 123e4567-e89b-12d3")
    return
  }

  try {
    await deleteTask(taskId)
    ctx.reply("Задача удалена!")
  } catch (error) {
    console.log(error)
    ctx.reply("Не удалось удалить задачу. Проверьте ID или API недоступен")
  }
})

bot.launch()
console.log("Бот запущен!")